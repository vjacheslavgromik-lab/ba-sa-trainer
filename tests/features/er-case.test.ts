import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkErCase, isErCaseSolved } from "../../src/features/er/checkErCase";
import { getCases } from "../../src/content/loader";

const reference = readFileSync(join(process.cwd(), "tests/fixtures/er/rental-reference.mmd"), "utf8");
const rules = getCases("4").find((c) => c.id === "M4-CASE-01")!.er!.rules;
const messages = (text: string) => checkErCase(text, rules).caseRemarks.map((r) => r.message);

describe("проверка ER-кейса (правила кейса)", () => {
  it("эталонная модель проката проходит без замечаний", () => {
    const r = checkErCase(reference, rules);
    expect(r.syntaxErrors).toEqual([]);
    expect(r.remarks).toEqual([]);
    expect(r.caseRemarks).toEqual([]);
    expect(isErCaseSolved(r)).toBe(true);
  });

  it("имена сущностей и атрибутов по-русски тоже принимаются", () => {
    const ru = `erDiagram
  Клиент ||--o{ Аренда : "оформляет"
  Аренда ||--|{ Позиция_аренды : "включает"
  Снаряжение ||--o{ Позиция_аренды : "сдаётся в"
  Тип_снаряжения ||--o{ Снаряжение : "объединяет"
  Клиент {
    int код PK
    string телефон UK
  }
  Аренда {
    int код PK
    int код_клиента FK
    date дата_начала
    date дата_окончания
  }
  Позиция_аренды {
    int код_аренды PK, FK
    int код_снаряжения PK, FK
    int залог
  }
  Снаряжение {
    int код PK
    int код_типа FK
    int цена_в_день
  }
  Тип_снаряжения {
    int код PK
    string название
  }
`;
    expect(isErCaseSolved(checkErCase(ru, rules))).toBe(true);
  });

  it("не хватает сущности: сообщение называет её, связи с ней не дублируют сообщений", () => {
    const text = reference
      .replace('  EQUIPMENT_TYPE ||--o{ EQUIPMENT : "объединяет"\n', "")
      .replace(/  EQUIPMENT_TYPE \{[\s\S]*?\n  \}\n/, "")
      .replace("    int equipment_type_id FK\n", "");
    expect(messages(text)).toEqual(["В модели нет сущности «Тип снаряжения»."]);
  });

  it("не хватает атрибута: нет телефона и залога", () => {
    const text = reference.replace("    string phone UK\n", "").replace("    int deposit\n", "");
    expect(messages(text)).toEqual(["У сущности «Клиент» нет атрибута «телефон».", "У сущности «Позиция аренды» нет атрибута «залог»."]);
  });

  it("связь «многие ко многим» вместо промежуточной сущности: тренажёр и кейс отмечают отсутствие позиции аренды", () => {
    const text = `erDiagram
  CUSTOMER ||--o{ RENTAL : "оформляет"
  RENTAL }o--o{ EQUIPMENT : "включает"
  EQUIPMENT_TYPE ||--o{ EQUIPMENT : "объединяет"
  CUSTOMER {
    int id PK
    string phone
  }
  RENTAL {
    int id PK
    int customer_id FK
    date start_date
    date end_date
  }
  EQUIPMENT {
    int id PK
    int equipment_type_id FK
    int price_per_day
  }
  EQUIPMENT_TYPE {
    int id PK
  }
`;
    const r = checkErCase(text, rules);
    expect(r.remarks.map((x) => x.rule)).toContain("many-to-many");
    expect(r.caseRemarks.map((x) => x.message)).toContain("В модели нет сущности «Позиция аренды».");
    expect(isErCaseSolved(r)).toBe(false);
  });

  it("неверная кратность: у клиента «много» вместо «один» — связь не распознана", () => {
    const text = reference.replace('CUSTOMER ||--o{ RENTAL : "оформляет"', 'CUSTOMER }o--o{ RENTAL : "оформляет"');
    const r = checkErCase(text, rules);
    expect(r.caseRemarks.map((x) => x.message)).toContain("Нет связи «один ко многим» «Клиент — Аренда» (слева «один», справа «много» или наоборот по смыслу).");
  });

  it("связь записана в обратном порядке: RENTAL }o--|| CUSTOMER тоже засчитывается", () => {
    const text = reference.replace('CUSTOMER ||--o{ RENTAL : "оформляет"', 'RENTAL }o--|| CUSTOMER : "принадлежит"');
    expect(isErCaseSolved(checkErCase(text, rules))).toBe(true);
  });

  it("замечания общих правил тренажёра сохраняются: нет ключа, нет названия связи", () => {
    const text = reference.replace("    int id PK\n    string title\n  }\n", "    int id\n    string title\n  }\n").replace('"объединяет"', "").replace(' : ', ' ');
    const r = checkErCase(reference.replace('EQUIPMENT_TYPE ||--o{ EQUIPMENT : "объединяет"', "EQUIPMENT_TYPE ||--o{ EQUIPMENT"), rules);
    expect(r.remarks.map((x) => x.rule)).toEqual(["no-label"]);
    expect(isErCaseSolved(r)).toBe(false);
    expect(text.length).toBeGreaterThan(0);
  });

  it("при синтаксической ошибке правила кейса не проверяются", () => {
    const r = checkErCase("erDiagram\n  мусор в тексте\n", rules);
    expect(r.syntaxErrors.length).toBeGreaterThan(0);
    expect(r.caseRemarks).toEqual([]);
  });

  it("правило «один к одному»: связь «один ко многим» ей не удовлетворяет", () => {
    const oneToOne = { entities: [{ id: "a", label: "A", names: ["A"] }, { id: "b", label: "B", names: ["B"] }], relations: [{ from: "a", to: "b", kind: "one-to-one" as const, label: "A — B" }] };
    const base = (marker: string) => `erDiagram\n  A ${marker} B : x\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n`;
    expect(checkErCase(base("||--||"), oneToOne).caseRemarks).toEqual([]);
    expect(checkErCase(base("||--o|"), oneToOne).caseRemarks).toEqual([]);
    expect(checkErCase(base("||--o{"), oneToOne).caseRemarks).toHaveLength(1);
  });
});
