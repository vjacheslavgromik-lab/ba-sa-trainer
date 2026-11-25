// Прогресс в localStorage с версией схемы (ADR-6).
export const SCHEMA_VERSION = 1;
const KEY = "ba-sa-progress";

export interface CaseProgress {
  answers: Record<string, number>;
  /** Ответ на практический кейс; необязательное поле, добавлено без смены версии схемы. */
  practice?: { answer: string; submitted: boolean; checks?: boolean[] };
}

export interface Progress {
  schemaVersion: number;
  cases: Record<string, CaseProgress>;
}

export const PASS_THRESHOLD = 0.75;

export function emptyProgress(): Progress {
  return { schemaVersion: SCHEMA_VERSION, cases: {} };
}

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const data = JSON.parse(raw) as Progress;
    if (data.schemaVersion !== SCHEMA_VERSION) return emptyProgress();
    return data;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Хранилище недоступно — прогресс остаётся только в памяти.
  }
}

/** Доля верных ответов по кейсу: answers — ответы пользователя, correct — эталонные индексы. */
export function scoreCase(answers: Record<string, number>, correct: Record<string, number>): number {
  const ids = Object.keys(correct);
  if (ids.length === 0) return 0;
  const right = ids.filter((id) => answers[id] === correct[id]).length;
  return right / ids.length;
}

export function isPassed(score: number): boolean {
  return score >= PASS_THRESHOLD;
}

/** Минимальное число верных ответов из total, при котором порог пройден (US-4.2). */
export function requiredCorrect(total: number): number {
  return Math.ceil(total * PASS_THRESHOLD);
}

// Экспорт и импорт прогресса (US-7.2, US-7.3, ADR-6).

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** JSON-файл прогресса: данные и версия схемы, плюс время экспорта для справки. */
export function serializeProgress(progress: Progress, now: Date = new Date()): string {
  return JSON.stringify({ ...progress, exportedAt: now.toISOString() }, null, 2);
}

export type ParseResult = { ok: true; progress: Progress } | { ok: false; error: string };

/**
 * Проверяет содержимое файла и собирает из него прогресс заново: лишние поля отбрасываются.
 * Ничего не пишет в хранилище; запись выполняет вызывающий код после подтверждения.
 */
export function parseProgress(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Файл повреждён: это не JSON." };
  }
  if (!isRecord(data)) return { ok: false, error: "Файл повреждён: ожидался объект прогресса." };
  if (data.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Версия схемы файла (${String(data.schemaVersion)}) не поддерживается, нужна ${SCHEMA_VERSION}.`,
    };
  }
  if (!isRecord(data.cases)) return { ok: false, error: "Файл повреждён: нет раздела с кейсами." };

  const cases: Progress["cases"] = {};
  for (const [id, raw] of Object.entries(data.cases)) {
    if (!isRecord(raw) || !isRecord(raw.answers)) {
      return { ok: false, error: `Файл повреждён: у кейса «${id}» нет ответов.` };
    }
    const answers: Record<string, number> = {};
    for (const [qid, value] of Object.entries(raw.answers)) {
      if (!Number.isInteger(value) || (value as number) < 0) {
        return { ok: false, error: `Файл повреждён: у кейса «${id}» некорректный ответ на вопрос «${qid}».` };
      }
      answers[qid] = value as number;
    }
    const entry: CaseProgress = { answers };
    if (raw.practice !== undefined) {
      const p = raw.practice;
      if (
        !isRecord(p) ||
        typeof p.answer !== "string" ||
        typeof p.submitted !== "boolean" ||
        (p.checks !== undefined && (!Array.isArray(p.checks) || !p.checks.every((c) => typeof c === "boolean")))
      ) {
        return { ok: false, error: `Файл повреждён: у кейса «${id}» некорректный практический ответ.` };
      }
      entry.practice = { answer: p.answer, submitted: p.submitted, ...(p.checks ? { checks: p.checks as boolean[] } : {}) };
    }
    cases[id] = entry;
  }
  return { ok: true, progress: { schemaVersion: SCHEMA_VERSION, cases } };
}

export interface ProgressSummary {
  cases: number;
  theoryAnswered: number;
  practiceSent: number;
}

/** Краткая сводка для экрана «Прогресс» и предпросмотра импорта. */
export function summarizeProgress(progress: Progress): ProgressSummary {
  const entries = Object.values(progress.cases);
  return {
    cases: entries.length,
    theoryAnswered: entries.filter((c) => Object.keys(c.answers).length > 0).length,
    practiceSent: entries.filter((c) => c.practice?.submitted === true).length,
  };
}
