import { describe, it, expect } from "vitest";
import { parseClassDiagram } from "../../src/features/classdiagram/parseClass";
import { checkClassDiagram, isManyMultiplicity, type ClassRule } from "../../src/features/classdiagram/checkClass";
import { GOOD_SAMPLE, BAD_SAMPLE } from "../../src/features/classdiagram/ClassTrainerView";

const rules = (src: string): ClassRule[] => checkClassDiagram(src).remarks.map((r) => r.rule);

const MIN = `classDiagram
  class A {
    -String name
  }
  class B {
    -int count
  }
  A "1" --> "0..*" B : owns
`;

describe("разбор classDiagram", () => {
  it("читает классы, атрибуты с видимостью и типом, операции и связи", () => {
    const m = parseClassDiagram(GOOD_SAMPLE);
    expect(m.errors).toEqual([]);
    expect(m.classes.map((c) => c.name)).toEqual(["Customer", "Order", "OrderItem", "Product", "Category"]);
    const customer = m.classes[0];
    expect(customer.attributes).toEqual([
      { raw: "-String name", visibility: "-", name: "name", hasType: true },
      { raw: "-String email", visibility: "-", name: "email", hasType: true },
    ]);
    expect(customer.operations).toHaveLength(1);
    expect(m.relations).toHaveLength(4);
    expect(m.relations[0]).toMatchObject({ from: "Customer", to: "Order", kind: "association", fromMultiplicity: "1", toMultiplicity: "0..*", label: "makes" });
    expect(m.relations[1].kind).toBe("composition");
    expect(m.relations[3].kind).toBe("aggregation");
  });

  it("понимает запись «имя: тип», русские имена и члены вне блока", () => {
    const m = parseClassDiagram('classDiagram\n  class Клиент {\n    -имя: String\n    -возраст\n  }\n  Заказ : +int номер\n  Клиент "1" --> "0..*" Заказ : делает\n');
    expect(m.errors).toEqual([]);
    expect(m.classes.map((c) => c.name)).toEqual(["Клиент", "Заказ"]);
    expect(m.classes[0].attributes.map((a) => [a.name, a.hasType])).toEqual([["имя", true], ["возраст", false]]);
    expect(m.classes[1].attributes[0]).toMatchObject({ name: "номер", visibility: "+", hasType: true });
    expect(m.relations[0]).toMatchObject({ from: "Клиент", to: "Заказ", label: "делает" });
  });

  it("распознаёт виды связей и направление обобщения и целого", () => {
    const kinds = (token: string) => parseClassDiagram(`classDiagram\n  A ${token} B\n`).relations[0].kind;
    expect(kinds("<|--")).toBe("inheritance");
    expect(kinds("--|>")).toBe("inheritance");
    expect(kinds("<|..")).toBe("realization");
    expect(kinds("..|>")).toBe("realization");
    expect(kinds("*--")).toBe("composition");
    expect(kinds("--*")).toBe("composition");
    expect(kinds("o--")).toBe("aggregation");
    expect(kinds("--o")).toBe("aggregation");
    for (const t of ["-->", "<--", "<-->", "--"]) expect(kinds(t), t).toBe("association");
    for (const t of ["..>", "<..", ".."]) expect(kinds(t), t).toBe("dependency");
  });

  it("понимает стереотип, комментарии, direction и однострочный пустой класс", () => {
    const m = parseClassDiagram("classDiagram\n  %% комментарий\n  direction LR\n  class Shape {\n    <<interface>>\n    +area() int\n  }\n  class Empty {}\n");
    expect(m.errors).toEqual([]);
    expect(m.classes[0].annotation).toBe("interface");
    expect(m.classes[0].operations).toHaveLength(1);
    expect(m.classes[1].declared).toBe(true);
  });

  it("сообщает о синтаксических ошибках: нет заголовка, непонятная строка, незакрытый блок", () => {
    expect(parseClassDiagram("class A {}\n").errors[0].message).toContain("classDiagram");
    const bad = parseClassDiagram("classDiagram\n  это не диаграмма\n");
    expect(bad.errors[0]).toMatchObject({ line: 2 });
    expect(parseClassDiagram("classDiagram\n  class A {\n    -int x\n").errors[0].message).toContain("не закрыт");
    expect(parseClassDiagram("").errors.length).toBeGreaterThan(0);
  });
});

describe("правила диаграммы классов", () => {
  it("корректный пример и минимальная диаграмма проходят без замечаний", () => {
    expect(checkClassDiagram(GOOD_SAMPLE).remarks).toEqual([]);
    expect(checkClassDiagram(MIN).remarks).toEqual([]);
  });

  const cases: [ClassRule, string, (s: string) => string][] = [
    ["undeclared", "класс в связи не описан", (s) => s + "  A --> C\n"],
    ["no-attributes", "у класса нет атрибутов", (s) => s.replace("    -int count\n", "    +run()\n")],
    ["attribute-visibility", "атрибут без видимости", (s) => s.replace("-String name", "String name")],
    ["attribute-type", "атрибут без типа", (s) => s.replace("-String name", "-name")],
    ["duplicate-attribute", "повтор атрибута", (s) => s.replace("-String name\n", "-String name\n    -int name\n")],
    ["isolated", "класс без связей", (s) => s.replace('  A "1" --> "0..*" B : owns\n', "")],
    ["no-multiplicity", "нет кратности", (s) => s.replace('A "1" --> "0..*" B', "A --> B")],
    ["no-label", "нет названия связи", (s) => s.replace(" : owns", "")],
    ["many-to-many", "многие ко многим", (s) => s.replace('"1"', '"0..*"')],
  ];
  for (const [rule, name, mutate] of cases) {
    it(`${rule}: ${name}`, () => {
      expect(rules(mutate(MIN))).toContain(rule);
    });
  }

  it("обобщение и зависимость не требуют кратности и названия; класс со стереотипом может не иметь атрибутов", () => {
    const src = "classDiagram\n  class P {\n    -String x\n  }\n  class Q {\n    -String y\n  }\n  class I {\n    <<interface>>\n    +run()\n  }\n  P <|-- Q\n  Q ..> I\n";
    expect(checkClassDiagram(src).remarks).toEqual([]);
  });

  it("кратность «много»: *, 0..*, 1..*, n; не «много»: 1, 0..1", () => {
    for (const m of ["*", "0..*", "1..*", "n"]) expect(isManyMultiplicity(m), m).toBe(true);
    for (const m of ["1", "0..1", "1..1", ""]) expect(isManyMultiplicity(m), m).toBe(false);
  });

  it("при ошибке синтаксиса правила не проверяются", () => {
    const r = checkClassDiagram("classDiagram\n  непонятно\n");
    expect(r.syntaxErrors).toHaveLength(1);
    expect(r.remarks).toEqual([]);
  });

  it("замечания содержат источник: Вендров или правило курса", () => {
    for (const r of checkClassDiagram(BAD_SAMPLE).remarks) expect(r.source, r.rule).toMatch(/Вендров|правило курса/);
  });

  it("пример с ошибками даёт все ожидаемые замечания", () => {
    const got = new Set(rules(BAD_SAMPLE));
    for (const r of ["attribute-visibility", "attribute-type", "duplicate-attribute", "no-attributes", "isolated", "no-multiplicity", "no-label", "many-to-many", "undeclared"] as ClassRule[]) {
      expect(got.has(r), r).toBe(true);
    }
  });
});
