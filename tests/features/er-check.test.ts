import { describe, it, expect } from "vitest";
import { parseEr } from "../../src/features/er/parseEr";
import { checkEr } from "../../src/features/er/checkEr";

const GOOD = `erDiagram
  STUDENT ||--o{ ENROLLMENT : "записан"
  COURSE ||--o{ ENROLLMENT : "включает"
  STUDENT {
    int id PK
    string name
  }
  COURSE {
    int id PK
    string title
  }
  ENROLLMENT {
    int student_id PK, FK
    int course_id PK, FK
    int grade
  }
`;

describe("разбор ER (US-5.3)", () => {
  it("читает сущности, атрибуты с ключами и связи", () => {
    const m = parseEr(GOOD);
    expect(m.errors).toEqual([]);
    expect(m.entities.map((e) => e.name)).toEqual(["STUDENT", "ENROLLMENT", "COURSE"]);
    expect(m.entities[0].attributes[0]).toEqual({ type: "int", name: "id", keys: ["PK"] });
    expect(m.relations).toHaveLength(2);
    expect(m.relations[0]).toMatchObject({ from: "STUDENT", to: "ENROLLMENT", left: "||", right: "o{", label: "записан" });
  });

  it("понимает составной ключ, комментарий и неидентифицирующую связь", () => {
    const m = parseEr('erDiagram\n  A }o..o| B : ссылается\n  A {\n    int id PK, FK "код"\n  }\n');
    expect(m.errors).toEqual([]);
    expect(m.entities[0].attributes[0]).toEqual({ type: "int", name: "id", keys: ["PK", "FK"], comment: "код" });
    expect(m.relations[0].identifying).toBe(false);
  });

  it("понимает имена сущностей и атрибутов на русском", () => {
    const m = parseEr("erDiagram\n  СТУДЕНТ ||--o{ ЗАПИСЬ : записан\n  СТУДЕНТ {\n    int код PK\n    string имя_студента\n  }\n");
    expect(m.errors).toEqual([]);
    expect(m.entities[0].name).toBe("СТУДЕНТ");
    expect(m.entities[0].attributes.map((a) => a.name)).toEqual(["код", "имя_студента"]);
    expect(m.relations[0]).toMatchObject({ from: "СТУДЕНТ", to: "ЗАПИСЬ" });
  });

  it("понимает необязательный тип с «?» и имя со звёздочкой как первичный ключ (Mermaid 12)", () => {
    const m = parseEr("erDiagram\n  PERSON {\n    string? middleName\n    int *id\n  }\n");
    expect(m.errors).toEqual([]);
    expect(m.entities[0].attributes).toEqual([
      { type: "string?", name: "middleName", keys: [] },
      { type: "int", name: "id", keys: ["PK"] },
    ]);
  });

  it("игнорирует комментарии %% и пустые строки", () => {
    expect(parseEr("erDiagram\n\n%% заметка\n  A {\n    int id PK %% ключ\n  }\n").errors).toEqual([]);
  });

  it("сообщает строку с ошибкой", () => {
    const m = parseEr("erDiagram\n  A ||--o{ B : x\n  это не диаграмма\n");
    expect(m.errors).toHaveLength(1);
    expect(m.errors[0].line).toBe(3);
  });

  it("требует заголовок erDiagram и закрытый блок", () => {
    expect(parseEr("graph TD\n").errors[0].message).toContain("erDiagram");
    expect(parseEr("erDiagram\n  A {\n    int id PK\n").errors.some((e) => e.message.includes("не закрыт"))).toBe(true);
    expect(parseEr("").errors.length).toBeGreaterThan(0);
  });

  it("сущность из пустого блока в одну строку не открывает блок", () => {
    expect(parseEr("erDiagram\n  A {}\n  B ||--o{ A : x\n").errors).toEqual([]);
  });
});

describe("правила проверки ER (US-5.3, FR-15)", () => {
  it("корректная диаграмма: замечаний нет", () => {
    expect(checkEr(GOOD)).toEqual({ syntaxErrors: [], remarks: [] });
  });

  it("нет первичного ключа: замечание с указанием сущности и источником", () => {
    const r = checkEr(GOOD.replace("int id PK\n    string title", "int id\n    string title"));
    const remark = r.remarks.find((x) => x.rule === "no-pk");
    expect(remark?.entity).toBe("COURSE");
    expect(remark?.message).toContain("нет первичного ключа");
    expect(remark?.source).toContain("с. 124–125");
  });

  it("связь многие ко многим требует промежуточной сущности", () => {
    const r = checkEr("erDiagram\n  A }o--o{ B : x\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n");
    expect(r.remarks.map((x) => x.rule)).toEqual(["many-to-many"]);
  });

  it("связь без названия", () => {
    const r = checkEr("erDiagram\n  A ||--o{ B\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n");
    expect(r.remarks.map((x) => x.rule)).toEqual(["no-label"]);
  });

  it("сущность, упомянутая в связи, но не описанная", () => {
    const r = checkEr("erDiagram\n  A ||--o{ B : x\n  A {\n    int id PK\n  }\n");
    expect(r.remarks.map((x) => [x.rule, x.entity])).toEqual([["undeclared", "B"]]);
  });

  it("изолированная сущность и внешний ключ без связи", () => {
    const r = checkEr(
      "erDiagram\n  A ||--o{ B : x\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n  C {\n    int id PK\n    int a_id FK\n  }\n",
    );
    expect(r.remarks.map((x) => x.rule).sort()).toEqual(["fk-without-relation", "isolated"]);
  });

  it("у замечаний уточнённые источники по страницам книги", () => {
    const src = (text: string, rule: string) => checkEr(text).remarks.find((r) => r.rule === rule)?.source;
    expect(src("erDiagram\n  A }o--o{ B : x\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n", "many-to-many")).toContain("с. 412–416 и 538");
    expect(src("erDiagram\n  A ||--o{ B\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n", "no-label")).toContain("с. 401");
    expect(src("erDiagram\n  A ||--o{ B : x\n  C {\n    int id PK\n  }\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n", "isolated")).toContain("с. 507");
    expect(src("erDiagram\n  A {\n    int id\n  }\n", "no-pk")).toContain("408–410");
  });

  it("повторяющийся атрибут", () => {
    const r = checkEr("erDiagram\n  A {\n    int id PK\n    string id\n  }\n");
    expect(r.remarks.map((x) => x.rule)).toEqual(["duplicate-attribute"]);
  });

  it("при синтаксической ошибке правила не проверяются", () => {
    const r = checkEr("erDiagram\n  мусор\n");
    expect(r.remarks).toEqual([]);
    expect(r.syntaxErrors[0].line).toBe(2);
  });
});
