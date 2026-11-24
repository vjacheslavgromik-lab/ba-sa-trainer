import { describe, it, expect } from "vitest";
import { scoreCase, isPassed, PASS_THRESHOLD } from "../../src/features/progress/progress";
import { getCases, getQuestion, getTheory } from "../../src/content/loader";

describe("Порог прохождения кейса (FR-17)", () => {
  it("считает долю верных ответов", () => {
    const correct = { a: 0, b: 1, c: 2, d: 3 };
    expect(scoreCase({ a: 0, b: 1, c: 2, d: 0 }, correct)).toBe(0.75);
  });
  it("пропускает при 75% и выше, не пропускает ниже", () => {
    expect(PASS_THRESHOLD).toBe(0.75);
    expect(isPassed(0.75)).toBe(true);
    expect(isPassed(0.5)).toBe(false);
  });
});

describe("Загрузка контента модуля 2", () => {
  it("находит теорию, кейс и вопросы", () => {
    expect(getTheory("2").length).toBeGreaterThan(0);
    const cases = getCases("2");
    expect(cases.length).toBeGreaterThan(0);
    for (const qid of cases[0].questions) expect(getQuestion(qid)).toBeDefined();
  });
});
