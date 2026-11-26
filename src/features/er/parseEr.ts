// Разбор подмножества Mermaid erDiagram: сущности с атрибутами и связи (US-5.3, ADR-5).
// Парсер нужен только для проверки правил; график строит сам Mermaid.

export type ErKey = "PK" | "FK" | "UK";

export interface ErAttribute {
  type: string;
  name: string;
  keys: ErKey[];
  comment?: string;
}

export interface ErEntity {
  name: string;
  /** Сущность описана блоком { ... } (а не только упомянута в связи). */
  declared: boolean;
  attributes: ErAttribute[];
}

/** Связь «A left--right B : label». left и right — токены Mermaid, например «||» и «o{». */
export interface ErRelation {
  from: string;
  to: string;
  left: string;
  right: string;
  identifying: boolean;
  label: string;
  line: number;
}

export interface ErParseError {
  line: number;
  text: string;
  message: string;
}

export interface ErModel {
  entities: ErEntity[];
  relations: ErRelation[];
  errors: ErParseError[];
}

// Имена могут быть на любом языке: Mermaid принимает кириллицу, студенты называют сущности по-русски.
const WORD = String.raw`[\p{L}_][\p{L}\p{N}_-]*`;
const NAME = String.raw`(?:"[^"]+"|${WORD})`;
const RELATION = new RegExp(String.raw`^(${NAME})\s+([|}][|o])(--|\.\.)([|o][|{])\s+(${NAME})\s*(?::\s*(.*))?$`, "u");
const ENTITY_OPEN = new RegExp(String.raw`^(${NAME})\s*(?:\[[^\]]*\])?\s*\{\s*(\})?$`, "u");
const ATTRIBUTE = new RegExp(
  String.raw`^([\p{L}_][\p{L}\p{N}_()[\],-]*\??)\s+(\*?${WORD})(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$`,
  "u",
);

const unquote = (s: string) => (s.startsWith('"') ? s.slice(1, -1) : s);

export function parseEr(source: string): ErModel {
  const model: ErModel = { entities: [], relations: [], errors: [] };
  const byName = new Map<string, ErEntity>();
  const entity = (name: string, declared: boolean): ErEntity => {
    let e = byName.get(name);
    if (!e) {
      e = { name, declared, attributes: [] };
      byName.set(name, e);
      model.entities.push(e);
    }
    if (declared) e.declared = true;
    return e;
  };

  const lines = source.split(/\r?\n/);
  let headerSeen = false;
  let current: ErEntity | null = null;

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const text = raw.replace(/%%.*$/, "").trim();
    if (text === "") return;
    const fail = (message: string) => model.errors.push({ line: lineNo, text, message });

    if (!headerSeen) {
      headerSeen = true;
      if (text !== "erDiagram") fail("Диаграмма должна начинаться со строки erDiagram.");
      return;
    }
    if (current) {
      if (text === "}") {
        current = null;
        return;
      }
      const m = ATTRIBUTE.exec(text);
      if (!m) {
        fail("Атрибут записывается как «тип имя [PK|FK|UK] \"комментарий\"».");
        return;
      }
      const keys = m[3] ? (m[3].split(",").map((k) => k.trim()) as ErKey[]) : [];
      // Звёздочка перед именем в Mermaid — маркер первичного ключа.
      const star = m[2].startsWith("*");
      if (star && !keys.includes("PK")) keys.unshift("PK");
      current.attributes.push({ type: m[1], name: star ? m[2].slice(1) : m[2], keys, ...(m[4] !== undefined ? { comment: m[4] } : {}) });
      return;
    }
    const rel = RELATION.exec(text);
    if (rel) {
      const from = unquote(rel[1]);
      const to = unquote(rel[5]);
      entity(from, false);
      entity(to, false);
      model.relations.push({
        from,
        to,
        left: rel[2],
        right: rel[4],
        identifying: rel[3] === "--",
        label: (rel[6] ?? "").trim().replace(/^"|"$/g, ""),
        line: lineNo,
      });
      return;
    }
    const open = ENTITY_OPEN.exec(text);
    if (open) {
      const e = entity(unquote(open[1]), true);
      if (!open[2]) current = e;
      return;
    }
    fail("Строка не распознана: ожидалась связь или описание сущности.");
  });

  if (current) {
    model.errors.push({ line: lines.length, text: "", message: "Блок сущности не закрыт символом }." });
  }
  if (!headerSeen) model.errors.push({ line: 1, text: "", message: "Введите диаграмму, начиная со строки erDiagram." });
  return model;
}
