// Правила структурной проверки Postman-коллекции (US-5.2, FR-13, ADR-5): метод, путь, тело, коды ответа.
import { isVariableSegment, parseCollection, type PmRequest } from "./parseCollection";

export type RuleId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "C1" | "C2" | "C3";

export const RULE_TITLES: Record<RuleId, string> = {
  P1: "Метод и тело",
  P2: "Тело JSON",
  P3: "Адрес и хост",
  P4: "Проверка кода ответа",
  P5: "Название запроса",
  P6: "Имена ресурсов REST",
  C1: "Обязательный запрос",
  C2: "Обязательный код ответа",
  C3: "Обязательное поле тела",
};

/**
 * Источники для ссылок на теорию (FR-16). Пока не заданы: теория модуля 9 и её источник не выбраны.
 * Ссылка показывается в результате, только если здесь указан текст.
 */
export const RULE_SOURCES: Record<RuleId, string | null> = {
  P1: null,
  P2: null,
  P3: null,
  P4: null,
  P5: null,
  P6: null,
  C1: null,
  C2: null,
  C3: null,
};

/** Правила кейса (задаются данными в файле кейса, ADR-5). Путь пишется с {id} вместо параметров. */
export interface CaseRequestRule {
  method: string;
  path: string;
  /** Коды ответа, которые должны проверяться тестами запросов к этому адресу (вместе). */
  statuses?: number[];
  /** Поля верхнего уровня, которые должны быть в JSON-теле. */
  bodyFields?: string[];
}
export interface CaseRules {
  requests?: CaseRequestRule[];
}

export interface Violation {
  number: number;
  rule: RuleId;
  title: string;
  /** Путь к запросу в коллекции; пусто для нарушений уровня коллекции. */
  location: string;
  message: string;
  source: string | null;
}

export type CheckOutcome =
  | { ok: false; error: string }
  | { ok: true; requestCount: number; violations: Violation[] };

const ALLOWED_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);
const NO_BODY = new Set(["GET", "DELETE"]);
const GENERIC_NAME = /^(new request|untitled request|untitled|request(\s*\d+)?|запрос(\s*\d+)?)$/i;
const VERB_PREFIX = /^(get|create|update|delete|add|remove|set|fetch|list|find|save|edit|post|put|search)(?=$|[A-Z_-])/;
const IRREGULAR_PLURALS = new Set(["people", "children", "men", "women", "media", "data", "news", "series"]);
const SKIP_SEGMENT = /^(api|v\d+|\{id\})$/i;

/** Для хоста и вложенных значений в теле: Postman-переменные {{x}} заменяются числом, чтобы тело разобралось как JSON. */
function parseJsonBody(raw: string): unknown {
  return JSON.parse(raw.replace(/\{\{[^}]*\}\}/g, "0"));
}

function singularize(word: string): string {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function pluralOf(word: string): string {
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  if (/(s|x|ch|sh)$/.test(word)) return word + "es";
  return word + "s";
}

export function checkCollection(text: string, caseRules?: CaseRules): CheckOutcome {
  const parsed = parseCollection(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const found: Omit<Violation, "number" | "title" | "source">[] = [];
  const add = (rule: RuleId, location: string, message: string) => found.push({ rule, location, message });

  for (const r of parsed.requests) checkRequest(r, add);
  if (caseRules) checkCaseRules(parsed.requests, caseRules, add);

  const violations = found.map((v, i) => ({ ...v, number: i + 1, title: RULE_TITLES[v.rule], source: RULE_SOURCES[v.rule] }));
  return { ok: true, requestCount: parsed.requests.length, violations };
}

function checkRequest(r: PmRequest, add: (rule: RuleId, location: string, message: string) => void): void {
  // P1. Метод и тело согласованы.
  if (NO_BODY.has(r.method) && r.hasBody) add("P1", r.location, `У запроса ${r.method} не должно быть тела.`);
  if (ALLOWED_WITH_BODY.has(r.method) && !r.hasBody) add("P1", r.location, `У запроса ${r.method} нет тела.`);

  // P2. Тело JSON: заголовок/язык и корректный JSON.
  if (r.hasBody && r.bodyRaw !== null) {
    if (!r.contentTypeJson) {
      add("P2", r.location, "Не указан заголовок Content-Type: application/json (или язык тела JSON).");
    }
    try {
      parseJsonBody(r.bodyRaw);
    } catch {
      add("P2", r.location, "Тело запроса не является корректным JSON.");
    }
  }

  // P3. Адрес не пустой, хост задан переменной.
  if (r.raw.trim() === "") {
    add("P3", r.location, "У запроса пустой адрес.");
  } else {
    if (!r.hostIsVariable) add("P3", r.location, "Хост зашит в адрес: используйте переменную, например {{baseUrl}}.");
    if (/\s/.test(r.raw.trim())) add("P3", r.location, "В адресе есть пробелы.");
  }

  // P4. Есть проверка кода ответа.
  if (!r.hasStatusAssertion) add("P4", r.location, "Нет проверки кода ответа (pm.response.to.have.status).");

  // P5. Осмысленное название.
  if (r.name.trim() === "" || GENERIC_NAME.test(r.name.trim())) add("P5", r.location, "Запрос не назван по смыслу.");

  // P6. Имена ресурсов в пути.
  checkResourceNames(r, add);
}

function checkResourceNames(r: PmRequest, add: (rule: RuleId, location: string, message: string) => void): void {
  const segments = r.rawSegments;
  segments.forEach((seg, i) => {
    if (isVariableSegment(seg) || SKIP_SEGMENT.test(seg)) return;
    const verb = VERB_PREFIX.exec(seg);
    if (verb) {
      add("P6", r.location, `В пути «${seg}» глагол «${verb[1]}»: метод HTTP уже задаёт действие, имя ресурса — существительное.`);
      return;
    }
    if (/[A-Z_]/.test(seg)) {
      add("P6", r.location, `Путь «${seg}»: используйте строчные буквы и дефисы.`);
    }
    const next = segments[i + 1];
    const isCollection = next !== undefined ? isVariableSegment(next) : r.method === "POST";
    const word = seg.toLowerCase();
    if (isCollection && !word.endsWith("s") && !IRREGULAR_PLURALS.has(word) && /^[a-z-]+$/.test(word)) {
      add("P6", r.location, `Ресурс «${seg}» называйте существительным во множественном числе: «${pluralOf(singularize(word))}».`);
    }
  });
}

function checkCaseRules(
  requests: PmRequest[],
  rules: CaseRules,
  add: (rule: RuleId, location: string, message: string) => void,
): void {
  for (const rule of rules.requests ?? []) {
    const method = rule.method.toUpperCase();
    const label = `${method} ${rule.path}`;
    const matches = requests.filter((r) => r.method === method && r.path === rule.path);
    if (matches.length === 0) {
      add("C1", "", `Нет запроса ${label}.`);
      continue;
    }
    const asserted = new Set(matches.flatMap((r) => r.statuses));
    for (const code of rule.statuses ?? []) {
      if (!asserted.has(code)) add("C2", matches[0].location, `Для ${label} нет проверки кода ${code}.`);
    }
    for (const field of rule.bodyFields ?? []) {
      const has = matches.some((r) => {
        if (r.bodyRaw === null) return false;
        try {
          const body = parseJsonBody(r.bodyRaw);
          return typeof body === "object" && body !== null && !Array.isArray(body) && field in body;
        } catch {
          return false;
        }
      });
      if (!has) add("C3", matches[0].location, `В теле ${label} нет поля «${field}».`);
    }
  }
}
