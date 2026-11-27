import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../../src/content/loader";

const parts = getTheoryParts("11");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/11/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");
const blocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("Теория модуля 11: порядок и состав", () => {
  it("восемь глав по порядку: от приёмки до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Приёмка системы и состав рабочей документации",
      "Документирование по ГОСТ",
      "Программа и методика испытаний (ПМИ)",
      "Руководство пользователя, обучение, база знаний и FAQ",
      "План миграции",
      "Служба поддержки и запросы на изменение",
      "Оценка результатов реализации",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты", () => {
    const all = parts.map((p) => p.body).join("\n").toLowerCase();
    for (const phrase of ["рабочей документации", "гост 19", "гост 34", "план миграции", "обучение пользователей", "уровни поддержки", "запрос на изменение", "результат реализации", "база знаний", "faq", "руководство пользователя", "программа и методика испытаний"]) {
      expect(all, phrase).toContain(phrase);
    }
  });

  it("в каждой главе (кроме словаря) есть цель, проверочные вопросы и источник", () => {
    for (const p of parts.slice(0, -1)) {
      expect(p.body, p.title).toContain("**Цель главы.**");
      expect(p.body, p.title).toContain("## Проверьте себя");
    }
    for (const src of sources) expect(src).not.toBe("");
  });

  it("главы о ГОСТ, ПМИ и руководстве честно сообщают, что тексты ГОСТ не читались", () => {
    for (const i of [1, 2, 3]) expect(sources[i], `глава ${i + 1}`).toMatch(/не удалось/);
    expect(parts[1].body).toContain("не пересказывает");
    expect(parts[2].body).toContain("рабочая схема курса");
  });

  it("источники: Вигерс и Вендров со ссылками, открытые источники с адресами", () => {
    for (const i of [3, 4, 5]) expect(sources[i], `глава ${i + 1}`).toMatch(/https:\/\//);
    expect(sources[5]).toMatch(/с\. 360/);
    expect(parts[6].body).toMatch(/с\. 37[34]/);
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 11: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["ISO", "International Organization for Standardization"],
    ["ГОСТ", "государственн"],
    ["ЕСПД", "Единая система программной документации"],
    ["ПМИ", "программа и методика испытаний"],
    ["FAQ", "Frequently Asked Questions"],
    ["CR", "change request"],
    ["CCB", "change control board"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])`);
      for (let i = 0; i < parts.length - 1; i++) {
        const text = prose(parts[i].body);
        const m = re.exec(text);
        if (!m) continue;
        expect(text.slice(Math.max(0, m.index - 150), m.index + 450).toLowerCase(), `глава ${i + 1}`).toContain(full.toLowerCase());
        return;
      }
      throw new Error(`${abbr} не найден`);
    });
  }

  it("словарь содержит все сокращения", () => {
    const glossary = parts[parts.length - 1].body;
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toContain(`| ${abbr} |`);
  });
});

describe("Теория модуля 11: примеры", () => {
  it("фрагмент ПМИ: у каждого требования способ из четырёх допустимых и измеримый критерий", () => {
    const text = blocks(parts[2].body)[0];
    const rows = text.split("\n").filter((l) => /^ТР-/.test(l));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const methods = new Set(["тестирование", "экспертиза", "демонстрация", "анализ"]);
    for (const r of rows) {
      const cols = r.split("|").map((c) => c.trim());
      expect(methods.has(cols[1]), r).toBe(true);
      expect(cols[2].length, r).toBeGreaterThan(10);
    }
    expect(new Set(rows.map((r) => r.split("|")[1].trim()))).toEqual(methods);
    expect(text).toContain("Критерий приёмки:");
  });

  it("оглавление руководства регистратора: семь разделов, среди них задачи и справочник", () => {
    const toc = blocks(parts[3].body)[0].trim().split("\n");
    expect(toc).toHaveLength(7);
    expect(toc.filter((l) => l.includes("(задача)")).length).toBeGreaterThanOrEqual(3);
    expect(toc.some((l) => l.includes("(справочник)"))).toBe(true);
  });

  it("план миграции содержит цель, состав, соответствие, качество, способ, проверку, откат, обучение и снятие", () => {
    const plan = blocks(parts[4].body)[0];
    for (const key of ["Цель:", "Не переносим:", "Состав:", "Соответствие:", "Качество:", "Способ:", "Проверка:", "Откат:", "Обучение:", "Снятие старого журнала:"]) expect(plan, key).toContain(key);
    expect(plan).toMatch(/более 1%/);
  });

  it("глава о поддержке называет три уровня, пять источников запросов и три аспекта анализа влияния", () => {
    const body = parts[5].body;
    for (const l of ["L1", "L2", "L3"]) expect(body, l).toContain(`**${l}`);
    const sourcesList = body.slice(body.indexOf("### Источники запросов"), body.indexOf("## Типы изменений"));
    expect((sourcesList.match(/^- \*\*/gm) ?? []).length).toBe(5);
    const impact = body.slice(body.indexOf("### Анализ влияния"), body.indexOf("## Пример для сети клиник"));
    expect((impact.match(/^\d\. /gm) ?? []).length).toBe(3);
  });

  it("отчёт по итогам: числа согласованы — 17 запросов равны 9 + 6 + 2", () => {
    const report = blocks(parts[6].body)[0];
    const m = /Изменения: (\d+) запросов; из них ошибок (\d+), улучшений (\d+), внешних событий (\d+)/.exec(report)!;
    expect(Number(m[1])).toBe(Number(m[2]) + Number(m[3]) + Number(m[4]));
  });
});
