import { describe, it, expect } from "vitest";
import { validateCase, validateQuestion, validateTheoryFrontmatter, parseFrontmatter } from "../../src/content/validate";

const goodCase = {
  id: "m2-c1", module: 2, title: "Use Case", condition: "Опишите вариант использования",
  checklist: ["Есть актёр", "Есть цель"], reference: "Эталон: ...",
  check: { type: "manual" }, questions: ["m2-q1"],
};
const goodQuestion = { id: "m2-q1", module: 2, prompt: "Что такое актёр?", options: ["A", "B"], correct: 1, theoryRef: "m2/sprint1" };

describe("validateCase", () => {
  it("принимает корректный кейс", () => {
    expect(validateCase("c.json", goodCase)).toEqual([]);
  });
  it("требует эталон и чек-лист", () => {
    const errs = validateCase("c.json", { ...goodCase, reference: "", checklist: [] });
    expect(errs.map((e) => e.path)).toEqual(expect.arrayContaining(["reference", "checklist"]));
  });
  it("отклоняет неизвестный тип проверки", () => {
    const errs = validateCase("c.json", { ...goodCase, check: { type: "llm" } });
    expect(errs.map((e) => e.path)).toContain("check.type");
  });
  it("требует хотя бы один вопрос для гейта", () => {
    const errs = validateCase("c.json", { ...goodCase, questions: [] });
    expect(errs.map((e) => e.path)).toContain("questions");
  });
  it("кейс без гейта (gate: none) не требует вопросов, но и не допускает их", () => {
    expect(validateCase("c.json", { ...goodCase, gate: "none", questions: [] })).toEqual([]);
    const { questions: _omit, ...withoutQuestions } = goodCase;
    expect(validateCase("c.json", { ...withoutQuestions, gate: "none" })).toEqual([]);
    const errs = validateCase("c.json", { ...goodCase, gate: "none" });
    expect(errs.map((e) => e.path)).toContain("questions");
  });
  it("отклоняет неизвестное значение gate", () => {
    expect(validateCase("c.json", { ...goodCase, gate: "never" }).map((e) => e.path)).toContain("gate");
    expect(validateCase("c.json", { ...goodCase, gate: "questions" })).toEqual([]);
  });
});

describe("validateQuestion", () => {
  it("принимает корректный вопрос", () => {
    expect(validateQuestion("q.json", goodQuestion)).toEqual([]);
  });
  it("требует ровно один индекс верного ответа в пределах вариантов", () => {
    expect(validateQuestion("q.json", { ...goodQuestion, correct: 5 }).map((e) => e.path)).toContain("correct");
    expect(validateQuestion("q.json", { ...goodQuestion, correct: [0, 1] as unknown as number }).map((e) => e.path)).toContain("correct");
  });
  it("требует минимум два варианта", () => {
    expect(validateQuestion("q.json", { ...goodQuestion, options: ["A"] }).map((e) => e.path)).toContain("options");
  });
});

describe("theory frontmatter", () => {
  const text = "---\nmodule: 2\nsprint: 1\ntitle: Требования\nsource: Вигерс, гл. 2\nreviewStatus: draft\n---\nТекст";
  it("принимает корректный frontmatter", () => {
    expect(validateTheoryFrontmatter("t.md", parseFrontmatter(text))).toEqual([]);
  });
  it("требует источник и допустимый статус проверки", () => {
    const bad = text.replace("source: Вигерс, гл. 2", "source:").replace("draft", "maybe");
    const paths = validateTheoryFrontmatter("t.md", parseFrontmatter(bad)).map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(["source", "reviewStatus"]));
  });
});
