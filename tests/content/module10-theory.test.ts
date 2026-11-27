import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../../src/content/loader";

const parts = getTheoryParts("10");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/10/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");
const blocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("Теория модуля 10: порядок и состав", () => {
  it("восемь глав по порядку: от роли аналитика до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Роль аналитика в реализации системы",
      "Виды тестирования: ручное и автоматизированное, модульное, интеграционное, приёмочное, регрессионное",
      "План тестирования и тест-кейс",
      "Трассируемость: от требования к тесту",
      "Система контроля версий (VCS)",
      "CI/CD и DevOps на уровне аналитика",
      "Код глазами аналитика: языки, парадигмы, среда разработки и фреймворки",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты", () => {
    const all = parts.map((p) => p.body).join("\n").toLowerCase();
    for (const phrase of ["разработка", "devops", "ручное", "автоматизированное", "фреймворк", "язык программирования", "парадигм", "среда разработки", "контроля версий", "план тестирования", "тест-кейс", "модульн", "интеграционн", "приёмочн", "ci/cd"]) {
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

  it("источники: книги со страницами, открытые с адресами, оговорка про недоступный глоссарий ISTQB", () => {
    for (const i of [0, 1, 3]) expect(sources[i], `глава ${i + 1}`).toMatch(/с\. \d+/);
    for (const i of [2, 4, 5, 6]) expect(sources[i], `глава ${i + 1}`).toMatch(/https:\/\//);
    expect(sources[1]).toContain("ISTQB");
    expect(sources[2]).toContain("ISTQB");
  });

  it("глава про код предупреждает об ограничениях источника", () => {
    expect(sources[6]).toContain("оспаривается");
    expect(sources[5]).toContain("не Фаулер");
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 10: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["ISO", "International Organization for Standardization"],
    ["FIT", "Framework for Integrated Test"],
    ["UAT", "User Acceptance Testing"],
    ["IEEE", "Institute of Electrical and Electronics Engineers"],
    ["QA", "quality assurance"],
    ["VCS", "Version Control System"],
    ["BDD", "Behavior-Driven Development"],
    ["CI", "Continuous Integration"],
    ["CD", "Continuous Delivery"],
    ["IDE", "Integrated Development Environment"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])`);
      for (let i = 0; i < parts.length - 1; i++) {
        const text = prose(parts[i].body);
        const m = re.exec(text);
        if (!m) continue;
        expect(text.slice(Math.max(0, m.index - 150), m.index + 450), `глава ${i + 1}`).toContain(full);
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

describe("Теория модуля 10: примеры", () => {
  it("пример плана содержит обязательные разделы", () => {
    const plan = blocks(parts[2].body)[0];
    for (const key of ["Идентификатор плана:", "Объекты:", "Проверяется:", "Не проверяется:", "Подход:", "Критерий успеха:", "Критерий приостановки:", "Среда:", "Ответственность:", "График:"]) expect(plan, key).toContain(key);
  });

  it("пример тест-кейса содержит идентификатор, цель, предусловие, шаги, ожидаемый результат и тип", () => {
    const tc = blocks(parts[2].body)[1];
    for (const key of ["ID:", "Цель:", "Предусловие:", "Шаги:", "Ожидаемый результат:", "Тип:"]) expect(tc, key).toContain(key);
  });

  it("матрица трассируемости: одно требование не пройдено, одно без теста", () => {
    const m = blocks(parts[3].body)[0];
    const rows = m.trim().split("\n").slice(1);
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.includes("не пройден"))).toHaveLength(1);
    expect(rows.filter((r) => r.includes("нет теста"))).toHaveLength(1);
  });

  it("конвейер «Виты» состоит из семи шагов, приёмочные сценарии идут после сборки и тестов", () => {
    const steps = blocks(parts[5].body)[0].trim().split("\n");
    expect(steps).toHaveLength(7);
    const idx = (s: string) => steps.findIndex((l) => l.includes(s));
    expect(idx("модульные и интеграционные")).toBeLessThan(idx("приёмочные сценарии"));
    expect(idx("приёмочные сценарии")).toBeLessThan(idx("среде приёмки пользователей"));
  });

  it("классы эквивалентности и граничные значения указаны для интервала записи", () => {
    const body = parts[2].body;
    for (const w of ["вчера (отказ)", "через 60 дней (проходит)", "через 61 день (отказ)"]) expect(body, w).toContain(w);
  });
});
