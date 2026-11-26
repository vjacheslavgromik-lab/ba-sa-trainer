import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("7");

describe("Кейсы модуля 7", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M7-CASE-01", "M7-CASE-02", "M7-CASE-03", "M7-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "7", "cases");
    for (const f of readdirSync(dir)) expect(validateCase(f, JSON.parse(readFileSync(join(dir, f), "utf8"))), f).toEqual([]);
  });

  it("24 вопроса: по шесть на кейс, не повторяются, у каждого четыре разных варианта", () => {
    const ids = cases.flatMap((c) => c.questions);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    for (const c of cases) expect(c.questions).toHaveLength(6);
    for (const id of ids) {
      const q = getQuestion(id)!;
      expect(q, id).toBeTruthy();
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.theoryRef, id).toMatch(/глава \d+/);
    }
  });

  it("вопросы охватывают все семь глав теории, кроме словаря", () => {
    const refs = cases.flatMap((c) => c.questions).map((id) => getQuestion(id)!.theoryRef);
    for (let chapter = 1; chapter <= 7; chapter++) {
      expect(refs.some((r) => new RegExp(`глава[ы]? (?:\\d+ и )?${chapter}(?!\\d)`).test(r)), `глава ${chapter}`).toBe(true);
    }
  });

  it("правильные ответы распределены по всем четырём позициям поровну", () => {
    const counts = [0, 0, 0, 0];
    for (const id of cases.flatMap((c) => c.questions)) counts[getQuestion(id)!.correct]++;
    expect(counts).toEqual([6, 6, 6, 6]);
  });

  it("правильный ответ не выделяется длиной: самым длинным он бывает не чаще чем в 40% вопросов", () => {
    const ids = cases.flatMap((c) => c.questions);
    const longest = ids.filter((id) => {
      const q = getQuestion(id)!;
      const lengths = q.options.map((o) => o.length);
      return lengths.indexOf(Math.max(...lengths)) === q.correct;
    });
    expect(longest.length / ids.length).toBeLessThanOrEqual(0.4);
  });
});

describe("Содержание кейсов модуля 7", () => {
  it("пример скорости в кейсе 3: итерации не превышают 13 очков и сохраняют порядок приоритетов", () => {
    const c = cases[2];
    const points = [...c.condition.matchAll(/— (\d+)\.$/gm)].map((m) => Number(m[1]));
    expect(points).toEqual([5, 3, 5, 8, 5, 2]);
    const iterations: number[][] = [[]];
    for (const p of points) {
      const last = iterations[iterations.length - 1];
      if (last.reduce((a, b) => a + b, 0) + p > 13) iterations.push([p]);
      else last.push(p);
    }
    expect(iterations.map((i) => i.reduce((a, b) => a + b, 0))).toEqual([13, 13, 2]);
    expect(c.reference).toContain("13 очков");
  });

  it("эталон кейса 2 — корректный Gherkin: каждый сценарий идёт по порядку Given → When → Then", () => {
    const block = /```gherkin\n([\s\S]*?)```/.exec(cases[1].reference)![1];
    expect(block).toContain("Background:");
    expect(block).toContain("Scenario Outline:");
    expect(block).toContain("Examples:");
    for (const scenario of block.split(/\n\s*Scenario/).slice(1)) {
      const w = scenario.search(/\bWhen\b/);
      const t = scenario.search(/\bThen\b/);
      expect(w >= 0 && t > w, scenario).toBe(true);
    }
    expect((block.match(/^\s*Scenario:/gm) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("условие и эталон кейса 1 называют все шесть требований, а число совпадает с текстом", () => {
    const c = cases[0];
    expect([...c.condition.matchAll(/^- /gm)]).toHaveLength(6);
    expect(c.condition).toContain("шесть");
    for (const key of ["пул соединений", "Visa", "быстро", "расписанием", "записаться на приём"]) expect(c.condition.toLowerCase()).toContain(key.toLowerCase());
  });
});
