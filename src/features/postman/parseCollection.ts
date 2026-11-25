// Разбор Postman Collection v2.1 для структурной проверки (US-5.2, ADR-5). Сеть не используется.

export const NOT_A_COLLECTION = "Файл не является коллекцией Postman";

export interface PmRequest {
  /** «Папка / Подпапка / Запрос»: путь к запросу в коллекции. */
  location: string;
  name: string;
  method: string;
  /** Адрес как записан в коллекции. */
  raw: string;
  /** Путь без хоста и запроса, переменные приведены к {id}: «/students/{id}». */
  path: string;
  /** Сегменты пути как записаны (переменные не заменены). */
  rawSegments: string[];
  /** Хост задан переменной ({{baseUrl}}); false — адрес зашит (http://…). */
  hostIsVariable: boolean;
  hasBody: boolean;
  bodyRaw: string | null;
  /** Тело задано как JSON (язык raw или заголовок Content-Type). */
  contentTypeJson: boolean;
  /** Коды, которые проверяются тестами запроса. */
  statuses: number[];
  hasStatusAssertion: boolean;
}

export type ParseOutcome = { ok: true; requests: PmRequest[] } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const VARIABLE_SEGMENT = /^(:[\w-]+|\{\{[^}]*\}\}|\{[^}]*\}|\d+|[0-9a-f]{8}-[0-9a-f-]{27})$/i;

/** Сегмент пути, который обозначает значение, а не ресурс: :id, {{id}}, {id}, число, UUID. */
export const isVariableSegment = (seg: string): boolean => VARIABLE_SEGMENT.test(seg);

/** Приводит адрес к пути без хоста и параметров. */
function splitUrl(raw: string): { host: boolean; segments: string[] } {
  let rest = raw.trim();
  let hostIsVariable = false;
  const proto = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(rest);
  if (proto) {
    rest = rest.slice(proto[0].length);
  } else if (rest.startsWith("{{")) {
    const end = rest.indexOf("}}");
    if (end !== -1) {
      hostIsVariable = true;
      rest = rest.slice(end + 2);
    }
  }
  rest = rest.split(/[?#]/)[0];
  return { host: hostIsVariable, segments: rest.split("/").filter((s) => s !== "") };
}

function urlText(url: unknown): string {
  if (typeof url === "string") return url;
  if (isObj(url)) {
    if (typeof url.raw === "string") return url.raw;
    const host = Array.isArray(url.host) ? url.host.join(".") : typeof url.host === "string" ? url.host : "";
    const path = Array.isArray(url.path) ? url.path.map(String).join("/") : typeof url.path === "string" ? url.path : "";
    return `${host}/${path}`;
  }
  return "";
}

function scriptText(events: unknown): string {
  if (!Array.isArray(events)) return "";
  return events
    .filter((e): e is Obj => isObj(e) && e.listen === "test" && isObj(e.script))
    .map((e) => {
      const exec = (e.script as Obj).exec;
      return Array.isArray(exec) ? exec.map(String).join("\n") : typeof exec === "string" ? exec : "";
    })
    .join("\n");
}

/** Коды ответа, которые проверяет тестовый скрипт. */
export function statusesFromScript(script: string): number[] {
  const found = new Set<number>();
  for (const m of script.matchAll(/pm\.response\.to\.have\.status\(\s*(\d{3})\s*\)/g)) found.add(Number(m[1]));
  for (const m of script.matchAll(/pm\.expect\(\s*pm\.response\.code\s*\)\s*\.to\.(?:eql|equal|eq)\(\s*(\d{3})\s*\)/g)) found.add(Number(m[1]));
  for (const m of script.matchAll(/pm\.expect\(\s*pm\.response\.code\s*\)\s*\.to\.be\.oneOf\(\s*\[([^\]]*)\]/g)) {
    for (const n of m[1].matchAll(/\d{3}/g)) found.add(Number(n[0]));
  }
  if (/pm\.response\.to\.be\.ok\b/.test(script)) found.add(200);
  return [...found].sort((a, b) => a - b);
}

function toRequest(item: Obj, location: string): PmRequest {
  const name = typeof item.name === "string" ? item.name : "";
  const req = item.request;
  const reqObj = isObj(req) ? req : {};
  const method = typeof reqObj.method === "string" ? reqObj.method.toUpperCase() : typeof req === "string" ? "GET" : "GET";
  const raw = urlText(typeof req === "string" ? req : reqObj.url);
  const { host, segments } = splitUrl(raw);
  const body = isObj(reqObj.body) ? reqObj.body : null;
  const mode = body && typeof body.mode === "string" ? body.mode : null;
  const bodyRaw = body && mode === "raw" && typeof body.raw === "string" ? body.raw : null;
  const hasBody = body !== null && mode !== null && !(mode === "raw" && (bodyRaw ?? "").trim() === "");
  const options = body && isObj(body.options) && isObj((body.options as Obj).raw) ? ((body.options as Obj).raw as Obj) : null;
  const headers = Array.isArray(reqObj.header) ? reqObj.header : [];
  const jsonHeader = headers.some(
    (h) =>
      isObj(h) &&
      typeof h.key === "string" &&
      h.key.toLowerCase() === "content-type" &&
      typeof h.value === "string" &&
      h.value.toLowerCase().includes("application/json") &&
      h.disabled !== true,
  );
  const script = scriptText(item.event);
  const statuses = statusesFromScript(script);
  return {
    location: location === "" ? name : `${location} / ${name}`,
    name,
    method,
    raw,
    path: "/" + segments.map((s) => (VARIABLE_SEGMENT.test(s) ? "{id}" : s)).join("/"),
    rawSegments: segments,
    hostIsVariable: host,
    hasBody,
    bodyRaw,
    contentTypeJson: jsonHeader || options?.language === "json",
    statuses,
    hasStatusAssertion: statuses.length > 0 || /pm\.response\.(?:code|to\.have\.status)/.test(script),
  };
}

function walk(items: unknown[], location: string, out: PmRequest[]): void {
  for (const raw of items) {
    if (!isObj(raw)) continue;
    const name = typeof raw.name === "string" ? raw.name : "";
    if (Array.isArray(raw.item)) {
      walk(raw.item, location === "" ? name : `${location} / ${name}`, out);
    } else if (raw.request !== undefined) {
      out.push(toRequest(raw, location));
    }
  }
}

export function parseCollection(text: string): ParseOutcome {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_A_COLLECTION };
  }
  if (!isObj(data) || !isObj(data.info) || !Array.isArray(data.item)) return { ok: false, error: NOT_A_COLLECTION };
  const schema = typeof data.info.schema === "string" ? data.info.schema : "";
  if (!/getpostman\.com\/json\/collection\/v2\.\d/.test(schema)) return { ok: false, error: NOT_A_COLLECTION };
  if (!/collection\/v2\.1/.test(schema)) {
    return { ok: false, error: "Поддерживается только формат Postman Collection v2.1. Экспортируйте коллекцию в v2.1." };
  }
  const requests: PmRequest[] = [];
  walk(data.item, "", requests);
  return { ok: true, requests };
}
