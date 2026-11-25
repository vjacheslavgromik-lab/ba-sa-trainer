import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";
import { checkCollection, type CaseRules } from "../../src/features/postman/checkCollection";

const cases = getCases("9");
const valid = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/postman/school-valid.json"), "utf8"));
const clone = () => structuredClone(valid);
const postmanCases = cases.filter((c) => c.check.type === "postman");
const check = (c: unknown, rules: CaseRules) => {
  const r = checkCollection(JSON.stringify(c), rules);
  if (!r.ok) throw new Error(r.error);
  return r.violations.map((v) => v.rule);
};

describe("Кейсы модуля 9 (US-8.3)", () => {
  it("четыре кейса: три Postman и один ручной по диаграмме", () => {
    expect(cases.map((c) => c.id)).toEqual(["M9-CASE-01", "M9-CASE-02", "M9-CASE-03", "M9-CASE-04"]);
    expect(postmanCases).toHaveLength(3);
    expect(cases[3].check.type).toBe("manual");
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "9", "cases");
    for (const f of readdirSync(dir)) {
      const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
      expect(validateCase(f, data), f).toEqual([]);
    }
  });

  it("у каждого кейса четыре своих вопроса, они не повторяются между кейсами и существуют", () => {
    const all = cases.flatMap((c) => c.questions);
    expect(all).toHaveLength(16);
    expect(new Set(all).size).toBe(16);
    for (const c of cases) {
      expect(c.questions).toHaveLength(4);
      for (const id of c.questions) {
        const q = getQuestion(id);
        expect(q, id).toBeTruthy();
        expect(q?.options).toHaveLength(4);
        expect(q?.correct).toBeGreaterThanOrEqual(0);
        expect(q?.correct).toBeLessThan(4);
        expect(new Set(q?.options).size).toBe(4);
        expect(q?.theoryRef).toMatch(/глава \d+/);
      }
    }
  });

  it("правильные ответы разложены по разным позициям, а не всегда на первой", () => {
    const positions = new Set(cases.flatMap((c) => c.questions).map((id) => getQuestion(id)?.correct));
    expect(positions.size).toBe(4);
  });
});

describe("Эталонная коллекция школы проходит правила всех Postman-кейсов", () => {
  for (const c of postmanCases) {
    it(`${c.id}: эталон без нарушений`, () => {
      expect(check(valid, c.postman?.rules ?? {})).toEqual([]);
    });
  }

  it("кейс 1: без проверки 404 для студента — нарушение C2", () => {
    const c = clone();
    c.item[0].item = c.item[0].item.filter((r: { name: string }) => r.name !== "Студент не найден");
    expect(check(c, postmanCases[0].postman?.rules ?? {})).toEqual(["C2"]);
  });

  it("кейс 2: POST без поля course_id — нарушение C3", () => {
    const c = clone();
    for (const r of c.item[1].item) if (r.request.method === "POST") r.request.body.raw = '{"student_id": 1}';
    expect(check(c, postmanCases[1].postman?.rules ?? {})).toEqual(["C3"]);
  });

  it("кейс 3: нет PUT — нарушение C1; хост зашит в адрес — P3", () => {
    const c = clone();
    c.item[0].item = c.item[0].item.filter((r: { request: { method: string } }) => r.request.method !== "PUT");
    expect(check(c, postmanCases[2].postman?.rules ?? {})).toEqual(["C1"]);
    const d = clone();
    d.item[0].item[0].request.url.raw = "http://localhost:3000/students";
    expect(check(d, postmanCases[2].postman?.rules ?? {})).toEqual(["P3"]);
  });

  it("кейс 3 требует все пять операций таблицы API школы", () => {
    const reqs = postmanCases[2].postman?.rules.requests ?? [];
    expect(reqs.map((r) => `${r.method} ${r.path}`)).toEqual([
      "GET /students",
      "GET /students/{id}",
      "POST /enrollments",
      "DELETE /enrollments/{id}",
      "PUT /students/{id}",
    ]);
  });
});
