// Правила проверки спецификации OpenAPI 3.1 (версия 2, пункт PRD о проверке структуры OpenAPI).
// Проверяется только структура документа, запросы к API не выполняются. Правила двух видов:
// из спецификации OpenAPI 3.1.1 и правила курса (модуль 9, глава 8; модуль 12, глава 9).
import { parseDocument } from "yaml";

export type OpenApiRule =
  | "not-mapping"
  | "version"
  | "no-info"
  | "no-content"
  | "path-slash"
  | "no-operation-id"
  | "duplicate-operation-id"
  | "no-responses"
  | "no-success-response"
  | "no-error-response"
  | "response-description"
  | "path-param-undeclared"
  | "path-param-unused"
  | "path-param-required"
  | "broken-ref"
  | "required-not-in-properties";

export interface OpenApiRemark {
  rule: OpenApiRule;
  message: string;
  /** Где найдено, в виде «paths./rentals.post» (путь по документу). */
  where: string;
  /** На что опирается правило: раздел спецификации или правило курса. */
  source: string;
}

export interface OpenApiCheckResult {
  /** Ошибки YAML, из-за которых правила не проверялись. */
  syntaxErrors: { line?: number; message: string }[];
  remarks: OpenApiRemark[];
  /** Сколько путей и операций нашлось в документе. */
  stats: { paths: number; operations: number };
}

const SRC_ROOT = "OpenAPI 3.1.1, 4.8.1 OpenAPI Object";
const SRC_INFO = "OpenAPI 3.1.1, 4.8.2 Info Object";
const SRC_PATHS = "OpenAPI 3.1.1, 4.8.8 Paths Object";
const SRC_PARAM = "OpenAPI 3.1.1, 4.8.12 Parameter Object";
const SRC_RESPONSE = "OpenAPI 3.1.1, 4.8.17 Response Object";
const SRC_REF = "OpenAPI 3.1.1, 4.8.23 Reference Object";
const SRC_SCHEMA = "OpenAPI 3.1.1, 4.8.24 Schema Object";
const SRC_COURSE = "правило курса (модуль 9, глава 8; модуль 12, глава 9)";

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

type Json = unknown;
type Obj = Record<string, unknown>;
const isObj = (v: Json): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Разбор ссылки вида «#/components/schemas/Name» по документу; внешние ссылки не проверяются. */
function resolveRef(doc: Obj, ref: string): { checked: boolean; value?: Json } {
  if (!ref.startsWith("#")) return { checked: false };
  const parts = ref.slice(1).split("/").filter((p) => p !== "").map((p) => decodeURIComponent(p).replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: Json = doc;
  for (const part of parts) {
    if (!isObj(cur) && !Array.isArray(cur)) return { checked: true };
    cur = (cur as Obj)[part];
    if (cur === undefined) return { checked: true };
  }
  return { checked: true, value: cur };
}

export function checkOpenApi(source: string): OpenApiCheckResult {
  const empty = { paths: 0, operations: 0 };
  const parsed = parseDocument(source);
  if (parsed.errors.length > 0) {
    return {
      syntaxErrors: parsed.errors.map((e) => ({ line: e.linePos?.[0]?.line, message: e.message.split("\n")[0] })),
      remarks: [],
      stats: empty,
    };
  }
  const doc: Json = parsed.toJS();
  if (!isObj(doc)) {
    return {
      syntaxErrors: [],
      remarks: [{ rule: "not-mapping", message: "Документ должен быть объектом: на верхнем уровне нужны поля openapi, info, paths.", where: "(корень)", source: SRC_ROOT }],
      stats: empty,
    };
  }
  const remarks: OpenApiRemark[] = [];
  const add = (rule: OpenApiRule, message: string, where: string, src: string) => remarks.push({ rule, message, where, source: src });

  // Версия и обязательные поля верхнего уровня.
  const version = doc.openapi;
  if (typeof version !== "string" && typeof version !== "number") {
    add("version", "Нет поля openapi с версией спецификации.", "openapi", SRC_ROOT);
  } else if (!/^3\.1(\.\d+)?$/.test(String(version))) {
    add("version", `Версия ${String(version)} не подходит: в курсе используется OpenAPI 3.1.x (например, 3.1.1).`, "openapi", SRC_ROOT);
  }
  const info = doc.info;
  if (!isObj(info) || typeof info.title !== "string" || info.title.trim() === "" || info.version === undefined || String(info.version).trim() === "") {
    add("no-info", "В info нужны название (title) и версия API (version).", "info", SRC_INFO);
  }
  const paths = isObj(doc.paths) ? doc.paths : undefined;
  if (paths === undefined && doc.components === undefined && doc.webhooks === undefined) {
    add("no-content", "В документе должно быть хотя бы одно из полей paths, components или webhooks.", "(корень)", SRC_ROOT);
  }

  // Операции.
  const operationIds = new Map<string, string>();
  let operations = 0;
  const pathEntries = paths ? Object.entries(paths) : [];
  for (const [path, item] of pathEntries) {
    if (!path.startsWith("/")) add("path-slash", `Адрес «${path}» должен начинаться с символа «/».`, `paths.${path}`, SRC_PATHS);
    if (!isObj(item)) continue;
    const template = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    const levelParams = collectParams(doc, item.parameters);
    for (const method of METHODS) {
      const op = item[method];
      if (!isObj(op)) continue;
      operations++;
      const where = `paths.${path}.${method}`;
      checkOperation(doc, op, where, template, levelParams, operationIds, add);
    }
  }

  // Ссылки, ответы и схемы по всему документу.
  walk(doc, "", (node, where) => {
    if (typeof node.$ref === "string") {
      const r = resolveRef(doc, node.$ref);
      if (r.checked && r.value === undefined) add("broken-ref", `Ссылка ${node.$ref} ведёт на несуществующий компонент.`, where || "(корень)", SRC_REF);
    }
    if (Array.isArray(node.required) && isObj(node.properties)) {
      const props = new Set(Object.keys(node.properties));
      for (const name of node.required) {
        if (typeof name === "string" && !props.has(name)) {
          add("required-not-in-properties", `Обязательное поле «${name}» не описано в properties.`, where || "(корень)", SRC_SCHEMA);
        }
      }
    }
  });
  const responses = isObj(doc.components) && isObj(doc.components.responses) ? doc.components.responses : {};
  for (const [name, r] of Object.entries(responses)) checkResponseDescription(r, `components.responses.${name}`, add);

  return { syntaxErrors: [], remarks, stats: { paths: pathEntries.length, operations } };
}

type Add = (rule: OpenApiRule, message: string, where: string, src: string) => void;

function collectParams(doc: Obj, list: Json): Obj[] {
  if (!Array.isArray(list)) return [];
  const out: Obj[] = [];
  for (const p of list) {
    if (!isObj(p)) continue;
    if (typeof p.$ref === "string") {
      const r = resolveRef(doc, p.$ref);
      if (isObj(r.value)) out.push(r.value);
    } else {
      out.push(p);
    }
  }
  return out;
}

function checkOperation(doc: Obj, op: Obj, where: string, template: string[], levelParams: Obj[], ids: Map<string, string>, add: Add) {
  if (typeof op.operationId !== "string" || op.operationId.trim() === "") {
    add("no-operation-id", "У операции нет operationId: он нужен для документации и генерации кода.", where, SRC_COURSE);
  } else if (ids.has(op.operationId)) {
    add("duplicate-operation-id", `operationId «${op.operationId}» повторяется (уже есть в ${ids.get(op.operationId)}).`, where, SRC_COURSE);
  } else {
    ids.set(op.operationId, where);
  }

  const params = [...levelParams, ...collectParams(doc, op.parameters)];
  const pathParams = params.filter((p) => p.in === "path");
  const declared = new Set(pathParams.map((p) => String(p.name)));
  for (const name of template) {
    if (!declared.has(name)) add("path-param-undeclared", `Параметр пути {${name}} есть в адресе, но не объявлен в parameters.`, where, SRC_PARAM);
  }
  for (const p of pathParams) {
    if (!template.includes(String(p.name))) add("path-param-unused", `Параметр пути «${String(p.name)}» объявлен, но его нет в адресе.`, where, SRC_PARAM);
    if (p.required !== true) add("path-param-required", `Параметр пути «${String(p.name)}» должен иметь required: true.`, where, SRC_PARAM);
  }

  if (!isObj(op.responses) || Object.keys(op.responses).length === 0) {
    add("no-responses", "У операции нет описанных ответов (responses).", where, SRC_RESPONSE);
    return;
  }
  const codes = Object.keys(op.responses);
  if (!codes.some((c) => /^2/.test(c) || c === "default")) add("no-success-response", "Нет ответа об успехе: добавьте код 2xx (например, 200 или 201).", where, SRC_COURSE);
  // Ошибка запроса возможна, если операция принимает данные: параметры или тело. Список без параметров ошибок может не иметь.
  const takesInput = params.length > 0 || template.length > 0 || op.requestBody !== undefined;
  if (takesInput && !codes.some((c) => /^4/.test(c) || c === "default")) {
    add("no-error-response", "Операция принимает данные, но нет ответа об ошибке: опишите хотя бы бизнес-ошибку (например, 404 или 409).", where, SRC_COURSE);
  }
  for (const [code, r] of Object.entries(op.responses)) checkResponseDescription(r, `${where}.responses.${code}`, add);
}

function checkResponseDescription(r: Json, where: string, add: Add) {
  if (!isObj(r) || "$ref" in r) return;
  if (typeof r.description !== "string" || r.description.trim() === "") {
    add("response-description", "У ответа нет описания (description): оно обязательно.", where, SRC_RESPONSE);
  }
}

function walk(node: Json, where: string, visit: (n: Obj, where: string) => void) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${where}[${i}]`, visit));
  } else if (isObj(node)) {
    visit(node, where);
    for (const [k, v] of Object.entries(node)) walk(v, where ? `${where}.${k}` : k, visit);
  }
}
