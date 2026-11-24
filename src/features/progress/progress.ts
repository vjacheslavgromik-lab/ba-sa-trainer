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
