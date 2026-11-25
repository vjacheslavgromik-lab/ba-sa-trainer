export type CheckType = "sql" | "postman" | "er" | "class" | "openapi" | "manual";
const CHECK_TYPES: CheckType[] = ["sql", "postman", "er", "class", "openapi", "manual"];

export interface ValidationError {
  file: string;
  path: string;
  message: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validateCase(file: string, data: unknown): ValidationError[] {
  const errs: ValidationError[] = [];
  const err = (path: string, message: string) => errs.push({ file, path, message });
  if (!isObj(data)) return [{ file, path: "", message: "кейс должен быть объектом" }];
  if (!isNonEmptyString(data.id)) err("id", "нет идентификатора кейса");
  if (typeof data.module !== "number") err("module", "номер модуля должен быть числом");
  if (!isNonEmptyString(data.title)) err("title", "нет заголовка");
  if (!isNonEmptyString(data.condition)) err("condition", "нет условия задания");
  if (!Array.isArray(data.checklist) || data.checklist.length === 0 || !data.checklist.every(isNonEmptyString))
    err("checklist", "чек-лист должен содержать хотя бы один пункт");
  if (!isNonEmptyString(data.reference)) err("reference", "нет эталонного решения");
  if (!isObj(data.check) || !CHECK_TYPES.includes(data.check.type as CheckType))
    err("check.type", `тип проверки должен быть одним из: ${CHECK_TYPES.join(", ")}`);
  if (isObj(data.check) && data.check.type === "sql") {
    if (!isObj(data.sql)) {
      err("sql", "для проверки типа sql нужен блок sql");
    } else {
      if (!isNonEmptyString(data.sql.setup)) err("sql.setup", "нет скрипта тестовой базы");
      if (!isNonEmptyString(data.sql.referenceQuery)) err("sql.referenceQuery", "нет эталонного запроса");
      if (!Array.isArray(data.sql.schema) || data.sql.schema.length === 0) {
        err("sql.schema", "нет описания таблиц и атрибутов");
      } else {
        data.sql.schema.forEach((e: unknown, i: number) => {
          const ok =
            isObj(e) &&
            isNonEmptyString(e.table) &&
            isNonEmptyString(e.title) &&
            isNonEmptyString(e.description) &&
            Array.isArray(e.attributes) &&
            e.attributes.length > 0 &&
            e.attributes.every((a: unknown) => isObj(a) && isNonEmptyString(a.name) && isNonEmptyString(a.type) && isNonEmptyString(a.note));
          if (!ok) err(`sql.schema.${i}`, "у сущности нужны table, title, description и атрибуты (name, type, note)");
        });
      }
      if (data.sql.ordered !== undefined && typeof data.sql.ordered !== "boolean") err("sql.ordered", "ordered должен быть true или false");
    }
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0 || !data.questions.every(isNonEmptyString))
    err("questions", "нужен хотя бы один вопрос для гейта (ID вопросов)");
  return errs;
}

export function validateQuestion(file: string, data: unknown): ValidationError[] {
  const errs: ValidationError[] = [];
  const err = (path: string, message: string) => errs.push({ file, path, message });
  if (!isObj(data)) return [{ file, path: "", message: "вопрос должен быть объектом" }];
  if (!isNonEmptyString(data.id)) err("id", "нет идентификатора вопроса");
  if (!isNonEmptyString(data.prompt)) err("prompt", "нет текста вопроса");
  if (!Array.isArray(data.options) || data.options.length < 2 || !data.options.every(isNonEmptyString))
    err("options", "нужно не менее двух вариантов ответа");
  if (!Number.isInteger(data.correct)) {
    err("correct", "укажите индекс единственного верного ответа");
  } else if (Array.isArray(data.options) && (data.correct as number) >= data.options.length) {
    err("correct", "индекс верного ответа выходит за пределы вариантов");
  }
  if (!isNonEmptyString(data.theoryRef)) err("theoryRef", "нет ссылки на источник (книга и страницы)");
  return errs;
}

export function validateTheoryFrontmatter(file: string, fm: Record<string, string>): ValidationError[] {
  const errs: ValidationError[] = [];
  const err = (path: string, message: string) => errs.push({ file, path, message });
  for (const key of ["module", "sprint", "title", "source", "reviewStatus"]) {
    if (!fm[key] || !fm[key].trim()) err(key, "нет обязательного поля frontmatter");
  }
  if (fm.reviewStatus && !["draft", "reviewed"].includes(fm.reviewStatus))
    err("reviewStatus", "допустимо: draft или reviewed");
  return errs;
}

export function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
