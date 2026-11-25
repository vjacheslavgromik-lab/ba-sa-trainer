import { parseFrontmatter } from "./validate";

// Загрузка контента модулей из папки content/modules (ADR-3).
// Теория — Markdown, кейсы и вопросы — JSON.

export interface QuestionData {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  theoryRef: string;
}

export interface SqlEntity {
  table: string;
  title: string;
  description: string;
  attributes: { name: string; type: string; note: string }[];
}

export interface CaseData {
  id: string;
  module: number;
  title: string;
  condition: string;
  checklist: string[];
  reference: string;
  check: { type: string };
  /** Правила проверки Postman-коллекции; есть у кейсов с check.type = "postman". */
  postman?: {
    rules: { requests?: { method: string; path: string; statuses?: number[]; bodyFields?: string[] }[] };
  };
  /** Данные SQL-проверки; есть у кейсов с check.type = "sql". */
  sql?: {
    setup: string;
    referenceQuery: string;
    ordered?: boolean;
    /** Описание таблиц и атрибутов для условия задания. */
    schema: SqlEntity[];
    /** Связи между таблицами текстом. */
    relations?: string[];
  };
  questions: string[];
}

const theoryFiles = import.meta.glob("/content/modules/*/theory/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const caseFiles = import.meta.glob("/content/modules/*/cases/*.json", { eager: true, import: "default" }) as Record<string, CaseData>;
const questionFiles = import.meta.glob("/content/modules/*/questions/*.json", { eager: true, import: "default" }) as Record<string, QuestionData>;

/** Файлы теории модуля в порядке имён: главы нумеруют префиксом в имени файла (01-…, 02-…). */
function theoryEntries(moduleId: string): [string, string][] {
  return Object.entries(theoryFiles)
    .filter(([path]) => path.includes(`/modules/${moduleId}/theory/`))
    .sort(([a], [b]) => a.localeCompare(b));
}

export function getTheory(moduleId: string): string[] {
  return theoryEntries(moduleId).map(([, text]) => text);
}

export interface TheoryPart {
  title: string;
  body: string;
}

/** Главы теории модуля: заголовок из frontmatter и текст без него, по порядку файлов. */
export function getTheoryParts(moduleId: string): TheoryPart[] {
  return theoryEntries(moduleId).map(([, text]) => ({
    title: parseFrontmatter(text).title?.replace(/^"|"$/g, "") ?? "",
    body: text.replace(/^---[\s\S]*?---/, ""),
  }));
}

export function getCases(moduleId: string): CaseData[] {
  return Object.entries(caseFiles)
    .filter(([path]) => path.includes(`/modules/${moduleId}/cases/`))
    .map(([, c]) => c)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getQuestion(id: string): QuestionData | undefined {
  return Object.values(questionFiles).find((q) => q.id === id);
}
