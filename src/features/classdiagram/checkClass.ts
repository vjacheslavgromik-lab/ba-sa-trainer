// Правила проверки диаграммы классов (версия 2). Источники: Вендров (п. 2.4.2, 2.5.3) и правила курса (модуль 4, глава 8).
import { parseClassDiagram, type ClassDiagramModel } from "./parseClass";

export type ClassRule =
  | "undeclared"
  | "no-attributes"
  | "attribute-visibility"
  | "attribute-type"
  | "duplicate-attribute"
  | "isolated"
  | "no-multiplicity"
  | "no-label"
  | "many-to-many";

export interface ClassRemark {
  rule: ClassRule;
  message: string;
  cls?: string;
  /** Источник по теме замечания. */
  source: string;
}

export interface ClassCheckResult {
  syntaxErrors: { line: number; message: string }[];
  remarks: ClassRemark[];
}

const SRC_CLASS = "Вендров, п. 2.4.2";
const SRC_DIAGRAM = "Вендров, п. 2.5.3";
const SRC_COURSE = "правило курса (модуль 4, глава 8)";

/** Кратность «много»: *, 0..*, 1..*, n. */
export const isManyMultiplicity = (m: string) => /(^|\.\.)(\*|n)$/i.test(m.trim());

export function checkClassDiagram(source: string): ClassCheckResult {
  const model = parseClassDiagram(source);
  if (model.errors.length > 0) {
    return { syntaxErrors: model.errors.map((e) => ({ line: e.line, message: e.message })), remarks: [] };
  }
  return { syntaxErrors: [], remarks: applyRules(model) };
}

function applyRules(model: ClassDiagramModel): ClassRemark[] {
  const out: ClassRemark[] = [];
  const linked = new Set<string>();
  for (const r of model.relations) {
    linked.add(r.from);
    linked.add(r.to);
  }

  for (const c of model.classes) {
    if (!c.declared) {
      out.push({ rule: "undeclared", cls: c.name, message: `Класс «${c.name}» используется в связи, но не описан: добавьте атрибуты и операции.`, source: SRC_CLASS });
      continue;
    }
    // У класса со стереотипом (интерфейс, перечисление) атрибутов может не быть.
    if (c.attributes.length === 0 && c.annotation === undefined) {
      out.push({ rule: "no-attributes", cls: c.name, message: `У класса «${c.name}» нет атрибутов: класс объединяет данные и поведение.`, source: SRC_CLASS });
    }
    const seen = new Set<string>();
    for (const a of c.attributes) {
      if (a.visibility === undefined) {
        out.push({ rule: "attribute-visibility", cls: c.name, message: `У атрибута «${a.name}» класса «${c.name}» нет видимости: поставьте +, - или #.`, source: SRC_CLASS });
      }
      if (!a.hasType) {
        out.push({ rule: "attribute-type", cls: c.name, message: `У атрибута «${a.name}» класса «${c.name}» не указан тип.`, source: SRC_CLASS });
      }
      if (seen.has(a.name)) {
        out.push({ rule: "duplicate-attribute", cls: c.name, message: `Атрибут «${a.name}» в классе «${c.name}» повторяется.`, source: SRC_CLASS });
      }
      seen.add(a.name);
    }
    if (model.classes.length > 1 && !linked.has(c.name)) {
      out.push({ rule: "isolated", cls: c.name, message: `Класс «${c.name}» не связан ни с одним другим классом.`, source: SRC_DIAGRAM });
    }
  }

  for (const r of model.relations) {
    if (r.kind === "inheritance" || r.kind === "realization" || r.kind === "dependency") continue;
    const missing = [r.fromMultiplicity === "" ? `у «${r.from}»` : "", r.toMultiplicity === "" ? `у «${r.to}»` : ""].filter((s) => s !== "");
    if (missing.length > 0) {
      out.push({ rule: "no-multiplicity", message: `У связи «${r.from} — ${r.to}» не указана кратность ${missing.join(" и ")}.`, source: SRC_CLASS });
    }
    if (r.label === "") {
      out.push({ rule: "no-label", message: `У связи «${r.from} — ${r.to}» нет названия.`, source: SRC_COURSE });
    }
    if (r.kind === "association" && r.fromMultiplicity !== "" && r.toMultiplicity !== "" && isManyMultiplicity(r.fromMultiplicity) && isManyMultiplicity(r.toMultiplicity)) {
      out.push({
        rule: "many-to-many",
        message: `Связь «${r.from} — ${r.to}» многие ко многим: замените её классом-ассоциацией или промежуточным классом.`,
        source: SRC_CLASS,
      });
    }
  }
  return out;
}
