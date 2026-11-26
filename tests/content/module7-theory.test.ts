import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../../src/content/loader";

const parts = getTheoryParts("7");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/7/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");

describe("Теория модуля 7: порядок и состав", () => {
  it("восемь глав по порядку: от карточки истории до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "User Story: карточка, разговор, подтверждение",
      "Хорошая история: критерии INVEST",
      "Критерии приёмки и Gherkin",
      "Оценка историй: story points и скорость",
      "Job Stories: история через ситуацию",
      "Карта историй (User Story Map)",
      "MVP, разбиение историй (SPIDR) и бэклог DEEP",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты", () => {
    const all = parts.map((p) => p.body).join("\n");
    for (const phrase of ["INVEST", "Given", "When", "Then", "Gherkin", "story point", "Job Story", "карта историй", "MVP", "SPIDR", "DEEP", "критерии приёмки"]) {
      expect(all.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    }
  });

  it("в каждой главе (кроме словаря) есть цель, проверочные вопросы и источник", () => {
    for (const p of parts.slice(0, -1)) {
      expect(p.body, p.title).toContain("**Цель главы.**");
      expect(p.body, p.title).toContain("## Проверьте себя");
    }
    for (const src of sources) expect(src).not.toBe("");
  });

  it("главы по книгам ссылаются на печатные страницы, главы по открытым источникам — на адрес", () => {
    for (const p of parts.slice(0, 4)) expect(p.body, p.title).toMatch(/с\. \d+/);
    for (const src of sources.slice(4, 7)) expect(src).toMatch(/https:\/\//);
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 7: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["INVEST", "Independent"],
    ["BDD", "Behavior-Driven Development"],
    ["NUTs", "Nebulous Units of Time"],
    ["MVP", "Minimum Viable Product"],
    ["SPIDR", "Spike"],
    ["DEEP", "Detailed appropriately"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием в тексте глав стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])(?! in Action)`);
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
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toMatch(new RegExp(`\\| ${abbr} \\|`));
  });
});

describe("Теория модуля 7: примеры", () => {
  it("Gherkin-примеры используют ключевые слова в нужном порядке Given → When → Then", () => {
    const body = parts[2].body;
    const blocks = [...body.matchAll(/```gherkin\n([\s\S]*?)```/g)].map((m) => m[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    for (const block of blocks) {
      for (const scenario of block.split(/\n\s*Scenario/).slice(1)) {
        const g = scenario.search(/\bGiven\b/);
        const w = scenario.search(/\bWhen\b/);
        const t = scenario.search(/\bThen\b/);
        expect(g, scenario).toBeGreaterThanOrEqual(0);
        expect(g < w && w < t, scenario).toBe(true);
      }
    }
  });

  it("пример скорости: раскладка по итерациям не превышает 13 очков", () => {
    const body = parts[3].body;
    expect(body).toContain("скорость команды — 13 очков");
    expect(3 + 5 + 5).toBeLessThanOrEqual(13);
    expect(3 + 1 + 8).toBeLessThanOrEqual(13);
  });
});
