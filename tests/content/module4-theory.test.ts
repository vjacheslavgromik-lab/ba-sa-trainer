import { describe, it, expect } from "vitest";
import { getTheoryParts } from "../helpers/theory";
import { checkEr } from "../../src/features/er/checkEr";

const parts = getTheoryParts("4");
const byTitle = (start: string) => parts.find((p) => p.title.startsWith(start))!;
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");

describe("Теория модуля 4: порядок и состав", () => {
  it("десять глав по порядку: от моделей данных до словаря терминов", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Модели данных и уровни проектирования",
      "ER-модель: сущности, связи, атрибуты",
      "Ключи, кратность связей и слабые сущности",
      "Нотации ER: Чена, «воронья лапка» и UML",
      "Проверка ER-модели: ловушки соединения и правила тренажёра",
      "Нормализация",
      "Словарь данных",
      "Диаграммы классов UML",
      "Хранение данных: файлы, СУБД и производительность",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты: модели и уровни, ER (Чен, воронья лапка), нормализация, словарь данных, классы, хранилища, оптимизация", () => {
    const all = parts.map((p) => p.body).join("\n");
    for (const phrase of ["нотация Чена", "воронья лапка", "Crow's Foot", "1НФ", "2НФ", "3НФ", "словарь данных", "диаграмма классов", "индекс", "денормализ"]) {
      expect(all.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    }
  });

  it("в каждой главе (кроме словаря) есть цель, проверочные вопросы и ссылки на страницы источника", () => {
    for (const p of parts.slice(0, -1)) {
      expect(p.body, p.title).toContain("**Цель главы.**");
      expect(p.body, p.title).toContain("## Проверьте себя");
      expect(p.body, p.title).toMatch(/с\. \d+|п\. 2\./);
    }
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 4: расшифровка сокращений при первом упоминании", () => {
  const EXPANSIONS: [string, string][] = [
    ["ANSI-SPARC", "American National Standard Institute"],
    ["СУБД", "Database Management System"],
    ["ER", "Entity-Relationship"],
    ["UML", "Unified Modeling Language"],
    ["CASE", "Computer-Aided Software Engineering"],
    ["SQL", "Structured Query Language"],
    ["ISAM", "Indexed Sequential Access Method"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])`);
      for (let i = 0; i < parts.length; i++) {
        const text = prose(parts[i].body);
        const m = re.exec(text);
        if (!m) continue;
        expect(text.slice(Math.max(0, m.index - 120), m.index + 420), `глава ${i + 1}, первое упоминание ${abbr}`).toContain(full);
        return;
      }
      throw new Error(`${abbr} не найден`);
    });
  }

  it("словарь содержит все расшифрованные сокращения", () => {
    const glossary = parts[parts.length - 1].body;
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toMatch(new RegExp(`\\| ${abbr} \\|`));
    for (const t of ["PK, FK, UK", "НФБК", "ННФ, 1НФ, 2НФ, 3НФ"]) expect(glossary, t).toContain(`| ${t} |`);
  });
});

describe("Теория модуля 4: ER-примеры и тренажёр", () => {
  const erBlocks = (md: string) => [...md.matchAll(/```text\n(erDiagram[\s\S]*?)```/g)].map((m) => m[1]);

  it("полный пример «Накарабине» проходит проверку тренажёра без замечаний", () => {
    const [example] = erBlocks(byTitle("Нотации ER").body);
    const result = checkEr(example);
    expect(result.syntaxErrors).toEqual([]);
    expect(result.remarks).toEqual([]);
  });

  it("все фрагменты erDiagram в теории синтаксически корректны для тренажёра", () => {
    let count = 0;
    for (const p of parts) {
      for (const block of erBlocks(p.body)) {
        count++;
        expect(checkEr(block).syntaxErrors, `${p.title}`).toEqual([]);
      }
    }
    expect(count).toBe(5);
  });

  it("фрагменты ловушек показывают только связи: тренажёр отвечает, что сущности не описаны", () => {
    const blocks = erBlocks(byTitle("Проверка ER-модели").body);
    expect(blocks.length).toBe(4);
    for (const b of blocks) expect(checkEr(b).remarks.every((r) => r.rule === "undeclared")).toBe(true);
  });

  it("в примере присутствуют сущность-связка и составной ключ", () => {
    const [example] = erBlocks(byTitle("Нотации ER").body);
    expect(example).toContain("ORDER_ITEM");
    expect(example).toContain("int order_id PK, FK");
    expect(example).toContain("int product_id PK, FK");
  });
});

describe("Теория модуля 4: пример нормализации", () => {
  const body = byTitle("Нормализация").body;
  const relations = (block: string) =>
    [...block.matchAll(/^([\p{L}_]+)\(([^)]*)\)$/gmu)].map((m) => ({ name: m[1], attrs: m[2].split(",").map((a) => a.trim()) }));
  const textBlocks = [...body.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => relations(m[1])).filter((r) => r.length > 0);

  it("исходная таблица, 2НФ и 3НФ описаны отношениями", () => {
    expect(textBlocks.map((b) => b.length)).toEqual([1, 3, 4]);
  });

  it("при декомпозиции ни один атрибут не потерян и не добавлен", () => {
    const original = new Set(textBlocks[0][0].attrs);
    for (const step of textBlocks.slice(1)) {
      const union = new Set(step.flatMap((r) => r.attrs));
      expect(union).toEqual(original);
    }
  });

  it("в 3НФ получились четыре отношения, соответствующие сущностям ER-примера", () => {
    expect(textBlocks[2].map((r) => r.name).sort()).toEqual(["Заказ", "Клиент", "Позиция_заказа", "Товар"]);
    const attrs = (n: string) => textBlocks[2].find((r) => r.name === n)!.attrs;
    expect(attrs("Позиция_заказа")).toEqual(["номер_заказа", "артикул", "количество"]);
    expect(attrs("Клиент")).toEqual(["номер_клиента", "имя_клиента"]);
  });

  it("транзитивная зависимость устранена: имя клиента больше не в «Заказ»", () => {
    expect(textBlocks[1].find((r) => r.name === "Заказ")!.attrs).toContain("имя_клиента");
    expect(textBlocks[2].find((r) => r.name === "Заказ")!.attrs).not.toContain("имя_клиента");
  });

  it("таблица 1НФ содержит повторяющиеся значения цены для одного товара (избыточность)", () => {
    const rows = [...body.matchAll(/^\| (\d+) \| ([A-Z]-\d+) \|[^\n]*\| (\d+) \|/gm)];
    const prices = rows.filter((r) => r[2] === "T-2").map((r) => r[3]);
    expect(prices.length).toBeGreaterThanOrEqual(2);
    expect(new Set(prices).size).toBe(1);
  });
});

describe("Теория модуля 4: словарь данных и классы", () => {
  it("словарь данных различает системный каталог и документ аналитика", () => {
    const b = byTitle("Словарь данных").body;
    expect(b).toContain("Системный каталог СУБД");
    expect(b).toContain("Документация аналитика");
    expect(b).toContain("с. 505");
    expect(b).toContain("с. 508");
    expect(b).toContain("с. 511–512");
  });

  it("диаграммы классов: видимость, кратность и сопоставление с ER, ссылки по номерам разделов", () => {
    const b = byTitle("Диаграммы классов").body;
    expect(b).toContain("п. 2.4.2");
    expect(b).toContain("п. 2.5.3");
    expect(b).toContain("`0..*`");
    expect(b).toMatch(/аналогична кратности/);
  });
});
