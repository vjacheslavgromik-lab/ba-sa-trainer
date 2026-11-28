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
  /** Как открывается практика: по вопросам теории (по умолчанию) или сразу, без вопросов (выпускной проект). */
  gate?: "questions" | "none";
  /** Правила проверки Postman-коллекции; есть у кейсов с check.type = "postman". */
  postman?: {
    rules: { requests?: { method: string; path: string; statuses?: number[]; bodyFields?: string[] }[] };
  };
  /** Правила проверки ER-диаграммы; есть у кейсов с check.type = "er". */
  er?: {
    rules: {
      entities: { id: string; label: string; names: string[]; attributes?: { label: string; names: string[] }[] }[];
      relations?: { from: string; to: string; kind: "one-to-many" | "one-to-one"; label: string }[];
    };
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

const caseFiles = import.meta.glob("/content/modules/*/cases/*.json", { eager: true, import: "default" }) as Record<string, CaseData>;
const questionFiles = import.meta.glob("/content/modules/*/questions/*.json", { eager: true, import: "default" }) as Record<string, QuestionData>;

// Теория подгружается лениво, по файлам: основной файл приложения не содержит её текст.
// Здесь только список файлов (пути), сам текст загружается при открытии вкладки «Теория».
const theoryLoaders = import.meta.glob("/content/modules/*/theory/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

/** Пути файлов теории модуля в порядке имён: главы нумеруют префиксом в имени файла (01-…, 02-…). */
function theoryPaths(moduleId: string): string[] {
  return Object.keys(theoryLoaders)
    .filter((path) => path.includes(`/modules/${moduleId}/theory/`))
    .sort((a, b) => a.localeCompare(b));
}

/** Есть ли у модуля теория. Текст при этом не загружается. */
export function hasTheory(moduleId: string): boolean {
  return theoryPaths(moduleId).length > 0;
}

export interface TheoryPart {
  title: string;
  body: string;
}

/** Глава теории из текста файла: заголовок из frontmatter и текст без него. */
export function toTheoryPart(text: string): TheoryPart {
  return {
    title: parseFrontmatter(text).title?.replace(/^"|"$/g, "") ?? "",
    body: text.replace(/^---[\s\S]*?---/, ""),
  };
}

/** Главы теории модуля по порядку файлов; файлы загружаются при первом вызове. */
export async function loadTheoryParts(moduleId: string): Promise<TheoryPart[]> {
  const texts = await Promise.all(theoryPaths(moduleId).map((path) => theoryLoaders[path]()));
  return texts.map(toTheoryPart);
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
