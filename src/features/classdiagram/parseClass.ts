// Разбор подмножества Mermaid classDiagram: классы с атрибутами и операциями и связи между ними (версия 2).
// Парсер нужен только для проверки правил; график строит сам Mermaid.

export type Visibility = "+" | "-" | "#" | "~";

export interface ClassAttribute {
  /** Строка как записана студентом. */
  raw: string;
  visibility?: Visibility;
  name: string;
  /** Тип записан («String name» или «name: String»). */
  hasType: boolean;
}

export interface ClassOperation {
  raw: string;
  visibility?: Visibility;
}

export interface ClassModel {
  name: string;
  /** Класс описан блоком или строкой «Класс : член» (а не только упомянут в связи). */
  declared: boolean;
  /** Стереотип вида <<interface>>. */
  annotation?: string;
  attributes: ClassAttribute[];
  operations: ClassOperation[];
}

export type RelationKind = "association" | "aggregation" | "composition" | "inheritance" | "realization" | "dependency";

export interface ClassRelation {
  from: string;
  to: string;
  kind: RelationKind;
  /** Кратность у конца «from» и у конца «to»; пустая строка, если не указана. */
  fromMultiplicity: string;
  toMultiplicity: string;
  label: string;
  line: number;
}

export interface ClassParseError {
  line: number;
  text: string;
  message: string;
}

export interface ClassDiagramModel {
  classes: ClassModel[];
  relations: ClassRelation[];
  errors: ClassParseError[];
}

// Имена могут быть на любом языке: студенты называют классы по-русски.
const NAME = String.raw`[\p{L}_][\p{L}\p{N}_]*`;
const TOKENS = String.raw`<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|<-->|<--|-->|<\.\.|\.\.>|--|\.\.`;
const RELATION = new RegExp(String.raw`^(${NAME})\s+(?:"([^"]*)"\s+)?(${TOKENS})\s+(?:"([^"]*)"\s+)?(${NAME})\s*(?::\s*(.*))?$`, "u");
const CLASS_OPEN = new RegExp(String.raw`^class\s+(${NAME})\s*(\{)?\s*(\})?$`, "u");
const MEMBER_OUTSIDE = new RegExp(String.raw`^(${NAME})\s*:\s*(.+)$`, "u");
const VISIBILITY = /^[+\-#~]/;

const KIND: Record<string, { kind: RelationKind; swap?: boolean }> = {
  "<|--": { kind: "inheritance" },
  "--|>": { kind: "inheritance", swap: true },
  "<|..": { kind: "realization" },
  "..|>": { kind: "realization", swap: true },
  "*--": { kind: "composition" },
  "--*": { kind: "composition", swap: true },
  "o--": { kind: "aggregation" },
  "--o": { kind: "aggregation", swap: true },
  "-->": { kind: "association" },
  "<--": { kind: "association" },
  "<-->": { kind: "association" },
  "--": { kind: "association" },
  "..>": { kind: "dependency" },
  "<..": { kind: "dependency" },
  "..": { kind: "dependency" },
};

/** Разбирает один член класса: атрибут или операция. */
function addMember(model: ClassModel, text: string) {
  const raw = text.trim();
  if (raw === "") return;
  const visibility = VISIBILITY.test(raw) ? (raw[0] as Visibility) : undefined;
  const body = (visibility ? raw.slice(1) : raw).trim();
  if (body.includes("(")) {
    model.operations.push({ raw, visibility });
    return;
  }
  // «String name», «name: String» или просто «name».
  const colon = body.includes(":");
  const words = body.split(/\s+/).filter((w) => w !== "");
  const hasType = colon ? /:\s*\S/.test(body) : words.length >= 2;
  const name = colon ? body.split(":")[0].trim() : words[words.length - 1] ?? body;
  model.attributes.push({ raw, visibility, name, hasType });
}

export function parseClassDiagram(source: string): ClassDiagramModel {
  const result: ClassDiagramModel = { classes: [], relations: [], errors: [] };
  const byName = new Map<string, ClassModel>();
  const cls = (name: string, declared: boolean): ClassModel => {
    let c = byName.get(name);
    if (!c) {
      c = { name, declared, attributes: [], operations: [] };
      byName.set(name, c);
      result.classes.push(c);
    }
    if (declared) c.declared = true;
    return c;
  };

  const lines = source.split(/\r?\n/);
  let headerSeen = false;
  let open: ClassModel | null = null;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    const line = i + 1;
    if (text === "" || text.startsWith("%%")) continue;
    if (open) {
      if (text === "}") {
        open = null;
      } else if (/^<<.+>>$/.test(text)) {
        open.annotation = text.slice(2, -2).trim();
      } else {
        addMember(open, text);
      }
      continue;
    }
    if (!headerSeen) {
      if (/^classDiagram(-v2)?$/.test(text)) {
        headerSeen = true;
      } else {
        result.errors.push({ line, text, message: "Диаграмма должна начинаться со строки classDiagram." });
        return result;
      }
      continue;
    }
    if (/^direction\s+(LR|RL|TB|BT)$/.test(text)) continue;
    const classMatch = CLASS_OPEN.exec(text);
    if (classMatch) {
      const c = cls(classMatch[1], true);
      if (classMatch[2] && !classMatch[3]) open = c;
      continue;
    }
    const rel = RELATION.exec(text);
    if (rel) {
      const [, left, leftMult, token, rightMult, right, label] = rel;
      cls(left, false);
      cls(right, false);
      const info = KIND[token];
      result.relations.push({
        from: left,
        to: right,
        kind: info.kind,
        fromMultiplicity: leftMult ?? "",
        toMultiplicity: rightMult ?? "",
        label: (label ?? "").trim(),
        line,
      });
      continue;
    }
    const outside = MEMBER_OUTSIDE.exec(text);
    if (outside) {
      addMember(cls(outside[1], true), outside[2]);
      continue;
    }
    result.errors.push({ line, text, message: `Не удалось разобрать строку: «${text}».` });
  }
  if (!headerSeen) result.errors.push({ line: 1, text: "", message: "Диаграмма должна начинаться со строки classDiagram." });
  if (open) result.errors.push({ line: lines.length, text: "", message: `Блок класса «${open.name}» не закрыт символом }.` });
  return result;
}
