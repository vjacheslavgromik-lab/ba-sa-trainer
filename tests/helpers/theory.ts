// Синхронный доступ к теории для тестов. В приложении теория грузится лениво (src/content/loader.ts),
// а тестам удобнее получить главы сразу, поэтому здесь файлы подключаются сразу.
import { toTheoryPart, type TheoryPart } from "../../src/content/loader";

const files = import.meta.glob("/content/modules/*/theory/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function entries(moduleId: string): [string, string][] {
  return Object.entries(files)
    .filter(([path]) => path.includes(`/modules/${moduleId}/theory/`))
    .sort(([a], [b]) => a.localeCompare(b));
}

/** Тексты файлов теории модуля по порядку имён. */
export function getTheory(moduleId: string): string[] {
  return entries(moduleId).map(([, text]) => text);
}

/** Главы теории модуля: заголовок и текст без frontmatter. */
export function getTheoryParts(moduleId: string): TheoryPart[] {
  return getTheory(moduleId).map(toTheoryPart);
}
