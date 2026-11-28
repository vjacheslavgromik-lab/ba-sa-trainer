import { describe, it, expect } from "vitest";
import {
  scoreCase,
  isPassed,
  requiredCorrect,
  PASS_THRESHOLD,
  SCHEMA_VERSION,
  emptyProgress,
  parseProgress,
  serializeProgress,
  summarizeProgress,
  type Progress,
} from "../../src/features/progress/progress";
import { getCases, getQuestion } from "../../src/content/loader";
import { getTheory } from "../helpers/theory";

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
  it("US-4.2: при 4 вопросах порог — 3 верных (2 из 4 не проходят, 3 из 4 проходят)", () => {
    expect(requiredCorrect(4)).toBe(3);
    expect(isPassed(2 / 4)).toBe(false);
    expect(isPassed(3 / 4)).toBe(true);
  });
  it("requiredCorrect округляет вверх для других размеров кейса", () => {
    expect(requiredCorrect(8)).toBe(6);
    expect(requiredCorrect(5)).toBe(4);
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

describe("экспорт и импорт прогресса (US-7.2, US-7.3)", () => {
  const sample: Progress = {
    schemaVersion: SCHEMA_VERSION,
    cases: {
      "M2-CASE-01": { answers: { "M2-Q01": 0, "M2-Q02": 1 }, practice: { answer: "ответ", submitted: true, checks: [true, false] } },
      "M3-CASE-01": { answers: {} },
    },
  };

  it("экспорт содержит версию схемы и данные, импорт возвращает те же данные", () => {
    const text = serializeProgress(sample, new Date("2026-11-25T10:00:00Z"));
    expect(JSON.parse(text).schemaVersion).toBe(SCHEMA_VERSION);
    expect(JSON.parse(text).exportedAt).toBe("2026-11-25T10:00:00.000Z");
    const result = parseProgress(text);
    expect(result).toEqual({ ok: true, progress: sample });
  });

  it("отклоняет не-JSON", () => {
    const r = parseProgress("{не json");
    expect(r.ok).toBe(false);
  });

  it("отклоняет JSON не того вида", () => {
    for (const text of ["[]", "null", "42", '"строка"']) expect(parseProgress(text).ok).toBe(false);
  });

  it("отклоняет другую версию схемы и называет её", () => {
    const r = parseProgress(JSON.stringify({ schemaVersion: 99, cases: {} }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("99");
  });

  it("отклоняет файл без версии и без раздела кейсов", () => {
    expect(parseProgress(JSON.stringify({ cases: {} })).ok).toBe(false);
    expect(parseProgress(JSON.stringify({ schemaVersion: SCHEMA_VERSION })).ok).toBe(false);
  });

  it("отклоняет некорректные ответы и практику", () => {
    const bad = (cases: unknown) => parseProgress(JSON.stringify({ schemaVersion: SCHEMA_VERSION, cases })).ok;
    expect(bad({ a: {} })).toBe(false);
    expect(bad({ a: { answers: { q: "0" } } })).toBe(false);
    expect(bad({ a: { answers: { q: -1 } } })).toBe(false);
    expect(bad({ a: { answers: {}, practice: { answer: 1, submitted: true } } })).toBe(false);
    expect(bad({ a: { answers: {}, practice: { answer: "x", submitted: "да" } } })).toBe(false);
    expect(bad({ a: { answers: {}, practice: { answer: "x", submitted: true, checks: ["да"] } } })).toBe(false);
  });

  it("отбрасывает лишние поля", () => {
    const r = parseProgress(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, extra: 1, cases: { a: { answers: { q: 1 }, junk: true } } }),
    );
    expect(r).toEqual({ ok: true, progress: { schemaVersion: SCHEMA_VERSION, cases: { a: { answers: { q: 1 } } } } });
  });

  it("считает сводку", () => {
    expect(summarizeProgress(sample)).toEqual({ cases: 2, theoryAnswered: 1, practiceSent: 1 });
    expect(summarizeProgress(emptyProgress())).toEqual({ cases: 0, theoryAnswered: 0, practiceSent: 0 });
  });
});
