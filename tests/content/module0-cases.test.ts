import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";
import { MODULES } from "../../src/data/modules";

const cases = getCases("0");
const block = (md: string) => /```text\n([\s\S]*?)```/.exec(md)?.[1] ?? "";
const ids = new Set(MODULES.map((m) => m.id));
const STAGES = ["Потребность", "Требования", "Проектирование", "Реализация", "Сдача", "Поддержка"];

describe("Кейсы модуля 0", () => {
  it("три ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M0-CASE-01", "M0-CASE-02", "M0-CASE-03"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "0", "cases");
    for (const f of readdirSync(dir)) expect(validateCase(f, JSON.parse(readFileSync(join(dir, f), "utf8"))), f).toEqual([]);
  });

  it("18 вопросов: по шесть на кейс, не повторяются, у каждого четыре разных варианта", () => {
    const all = cases.flatMap((c) => c.questions);
    expect(all).toHaveLength(18);
    expect(new Set(all).size).toBe(18);
    for (const c of cases) expect(c.questions).toHaveLength(6);
    for (const id of all) {
      const q = getQuestion(id)!;
      expect(q, id).toBeTruthy();
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.theoryRef, id).toMatch(/глава \d+/);
    }
  });

  it("вопросы охватывают главы 1–8 теории", () => {
    const refs = cases.flatMap((c) => c.questions).map((id) => getQuestion(id)!.theoryRef);
    for (let chapter = 1; chapter <= 8; chapter++) {
      expect(refs.some((r) => new RegExp(`глава ${chapter}(?!\\d)`).test(r)), `глава ${chapter}`).toBe(true);
    }
  });

  it("правильные ответы распределены по позициям почти поровну (4–5 на позицию)", () => {
    const counts = [0, 0, 0, 0];
    for (const id of cases.flatMap((c) => c.questions)) counts[getQuestion(id)!.correct]++;
    for (const n of counts) expect(n).toBeGreaterThanOrEqual(4);
    for (const n of counts) expect(n).toBeLessThanOrEqual(5);
    expect(counts.reduce((a, b) => a + b)).toBe(18);
  });

  it("длина не выдаёт ответ: верный не чаще чем в 40% вопросов самый длинный и не чаще чем в 40% самый короткий", () => {
    const all = cases.flatMap((c) => c.questions);
    const pos = (kind: "max" | "min") =>
      all.filter((id) => {
        const q = getQuestion(id)!;
        const lengths = q.options.map((o) => o.length);
        return lengths.indexOf(kind === "max" ? Math.max(...lengths) : Math.min(...lengths)) === q.correct;
      }).length / all.length;
    expect(pos("max")).toBeLessThanOrEqual(0.4);
    expect(pos("min")).toBeLessThanOrEqual(0.4);
  });
});

describe("Эталоны кейсов модуля 0", () => {
  it("кейс 1: восемь работ распределены по шести этапам (2, 2, 1, 1, 1, 1), модули существуют, порядок проекта верный", () => {
    const c = cases[0];
    expect([...c.condition.matchAll(/^- /gm)]).toHaveLength(8);
    const rows = block(c.reference).split("\n").filter((l) => /^\d\) /.test(l)).map((l) => l.split("|").map((x) => x.trim()));
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      expect(r).toHaveLength(4);
      expect(STAGES, r[0]).toContain(r[1]);
      expect(r[2].length, r[0]).toBeGreaterThan(5);
      expect(ids.has(r[3]), `модуль ${r[3]}`).toBe(true);
    }
    const counts = STAGES.map((s) => rows.filter((r) => r[1] === s).length);
    expect(counts).toEqual([2, 2, 1, 1, 1, 1]);
    const expectedByWork = ["Потребность", "Проектирование", "Реализация", "Требования", "Поддержка", "Потребность", "Сдача", "Требования"];
    expect(rows.map((r) => r[1])).toEqual(expectedByWork);
    // порядок проекта из эталона: 6 и 1, 8 и 4, 2, 3, 7, 5 — по возрастанию этапа
    const order = [6, 1, 8, 4, 2, 3, 7, 5].map((n) => STAGES.indexOf(rows[n - 1][1]));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(c.reference).toContain("30%");
  });

  it("кейс 2: восемь задач, у каждой исполнитель из шести ролей; интеграции и API у системного аналитика; граница названа практикой", () => {
    const c = cases[1];
    expect([...c.condition.matchAll(/^- /gm)]).toHaveLength(8);
    const lines = block(c.reference).trim().split("\n");
    expect(lines).toHaveLength(8);
    const ROLES = ["владелец продукта", "бизнес-аналитик", "системный аналитик", "архитектор", "разработчик", "тестировщик"];
    for (const l of lines) expect(ROLES.some((r) => l.includes(r)), l).toBe(true);
    const main = (n: number) => lines[n - 1].split("—")[1].split(";")[0].trim();
    expect(main(1)).toBe("владелец продукта");
    expect(main(2)).toBe("бизнес-аналитик");
    for (const n of [3, 4, 8]) expect(main(n), `задача ${n}`).toBe("системный аналитик");
    expect(main(5)).toBe("архитектор");
    expect(main(6)).toBe("разработчик");
    expect(main(7)).toBe("тестировщик");
    expect(c.reference).toContain("практика рынка, а не норма");
    expect(c.reference).toContain("интеграциях, спецификациях API");
  });

  it("кейс 3: вакансии A, B, C, пробелы сопоставлены с существующими модулями, порядок изучения без повторов и не длиннее пяти, вне курса названы Jira и английский", () => {
    const c = cases[2];
    const text = block(c.reference);
    expect([...c.condition.matchAll(/^- Вакансия [ABC]/gm)]).toHaveLength(3);
    const gaps = text.split("\n").filter((l) => /^(A|B|C), /.test(l)).map((l) => l.split("|").map((x) => x.trim()));
    expect(gaps).toHaveLength(3);
    const covered = new Set<string>();
    for (const g of gaps) {
      expect(g).toHaveLength(3);
      const nums = g[2].split(",").map((x) => x.trim());
      expect(nums.length, g[0]).toBeGreaterThan(0);
      for (const n of nums) {
        expect(ids.has(n), `модуль ${n}`).toBe(true);
        covered.add(n);
      }
    }
    const order = /Порядок изучения: ([\d, ]+)/.exec(text)![1].split(",").map((x) => x.trim());
    expect(new Set(order).size).toBe(order.length);
    expect(order.length).toBeLessThanOrEqual(5);
    for (const n of covered) expect(order, `модуль ${n}`).toContain(n);
    expect(order.indexOf("3")).toBeLessThan(order.indexOf("9"));
    expect(order.indexOf("9")).toBeLessThan(order.indexOf("12"));
    const outside = /Не закрывает курс: ([^\n]+)/.exec(text)![1];
    for (const w of ["Jira", "Confluence", "английский", "платёжные"]) expect(outside, w).toContain(w);
    expect(c.condition).toContain("английский средний");
  });
});
