// Правила проверки ER-диаграммы (US-5.3, FR-15). Начинаем с ограниченного набора и расширяем по мере наполнения кейсов.
import { parseEr, type ErModel } from "./parseEr";

export interface ErRemark {
  /** Код правила, стабильный для тестов и ссылок. */
  rule: "no-pk" | "undeclared" | "isolated" | "many-to-many" | "no-label" | "fk-without-relation" | "duplicate-attribute";
  message: string;
  entity?: string;
  /** Источник по теме замечания (FR-16). */
  source: string;
}

export interface ErCheckResult {
  /** Ошибки синтаксиса, из-за которых правила не проверялись. */
  syntaxErrors: { line: number; message: string }[];
  remarks: ErRemark[];
}

const SRC_KEYS = "Коннолли, Бегг, с. 124–125";
const SRC_REFINT = "Коннолли, Бегг, с. 129–130";
const SRC_ER = "Коннолли, Бегг, гл. 11, с. 397–428";

/** Связь «многие ко многим»: с обеих сторон «много» ({ или }). */
const isMany = (left: string, right: string) => left.startsWith("}") && right.endsWith("{");

export function checkEr(source: string): ErCheckResult {
  const model = parseEr(source);
  if (model.errors.length > 0) {
    return { syntaxErrors: model.errors.map((e) => ({ line: e.line, message: e.message })), remarks: [] };
  }
  return { syntaxErrors: [], remarks: applyRules(model) };
}

function applyRules(model: ErModel): ErRemark[] {
  const out: ErRemark[] = [];
  const linked = new Set<string>();
  for (const r of model.relations) {
    linked.add(r.from);
    linked.add(r.to);
  }

  for (const e of model.entities) {
    if (!e.declared) {
      out.push({
        rule: "undeclared",
        entity: e.name,
        message: `Сущность «${e.name}» используется в связи, но не описана: добавьте атрибуты.`,
        source: SRC_ER,
      });
      continue;
    }
    if (!e.attributes.some((a) => a.keys.includes("PK"))) {
      out.push({ rule: "no-pk", entity: e.name, message: `В сущности «${e.name}» нет первичного ключа.`, source: SRC_KEYS });
    }
    const seen = new Set<string>();
    for (const a of e.attributes) {
      if (seen.has(a.name)) {
        out.push({
          rule: "duplicate-attribute",
          entity: e.name,
          message: `В сущности «${e.name}» атрибут «${a.name}» указан несколько раз.`,
          source: SRC_KEYS,
        });
      }
      seen.add(a.name);
    }
    if (e.attributes.some((a) => a.keys.includes("FK")) && !linked.has(e.name)) {
      out.push({
        rule: "fk-without-relation",
        entity: e.name,
        message: `В сущности «${e.name}» есть внешний ключ, но нет связи, на которую он ссылается.`,
        source: SRC_REFINT,
      });
    }
    if (model.entities.length > 1 && !linked.has(e.name)) {
      out.push({ rule: "isolated", entity: e.name, message: `Сущность «${e.name}» ни с чем не связана.`, source: SRC_ER });
    }
  }

  for (const r of model.relations) {
    if (isMany(r.left, r.right)) {
      out.push({
        rule: "many-to-many",
        message: `Связь «${r.from}» — «${r.to}» многие ко многим: разделите её через промежуточную сущность.`,
        source: SRC_ER,
      });
    }
    if (r.label === "") {
      out.push({ rule: "no-label", message: `У связи «${r.from}» — «${r.to}» нет названия.`, source: SRC_ER });
    }
  }
  return out;
}
