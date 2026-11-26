// Проверка ER-кейса: общие правила тренажёра плюс правила кейса из файла кейса (ADR-5, US-5.3).
import { checkEr, type ErCheckResult, type ErRemark } from "./checkEr";
import { parseEr, type ErEntity, type ErModel, type ErRelation } from "./parseEr";

/** Допустимые виды связей в правилах кейса: «один ко многим» от первой сущности ко второй и «один к одному». */
export type ErRelationKind = "one-to-many" | "one-to-one";

export interface ErCaseRules {
  entities: {
    /** Идентификатор для ссылок из relations. */
    id: string;
    /** Название для сообщений. */
    label: string;
    /** Допустимые имена сущности (без учёта регистра, пробелов и подчёркиваний). */
    names: string[];
    /** Атрибуты, которые должны быть: хотя бы одно из имён в names. */
    attributes?: { label: string; names: string[] }[];
  }[];
  relations?: { from: string; to: string; kind: ErRelationKind; label: string }[];
}

export interface ErCaseResult extends ErCheckResult {
  /** Замечания по правилам кейса (пусты, пока в тексте есть синтаксические ошибки). */
  caseRemarks: { message: string }[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Максимум на конце связи: «много», если в маркере есть { или }, иначе «один». */
const isMany = (token: string) => token.includes("{") || token.includes("}");

function findEntity(model: ErModel, names: string[]): ErEntity | undefined {
  const wanted = new Set(names.map(norm));
  return model.entities.find((e) => e.declared && wanted.has(norm(e.name)));
}

/**
 * В `X l--r Y` левый маркер описывает X (сколько экземпляров X приходится на один Y),
 * правый — Y (сколько Y на один X). Пример: `CUSTOMER ||--o{ ORDER` — у заказа один клиент, у клиента много заказов.
 * Связь «a один ко многим b» — на стороне a максимум один, на стороне b «много»; порядок записи в диаграмме не важен.
 */
function relationMatches(rel: ErRelation, a: string, b: string, kind: ErRelationKind): boolean {
  const direct = rel.from === a && rel.to === b;
  const reverse = rel.from === b && rel.to === a;
  if (!direct && !reverse) return false;
  const aSide = direct ? rel.left : rel.right;
  const bSide = direct ? rel.right : rel.left;
  if (kind === "one-to-one") return !isMany(aSide) && !isMany(bSide);
  return !isMany(aSide) && isMany(bSide);
}

export function checkErCase(source: string, rules: ErCaseRules): ErCaseResult {
  const base = checkEr(source);
  if (base.syntaxErrors.length > 0) return { ...base, caseRemarks: [] };

  const model = parseEr(source);
  const caseRemarks: { message: string }[] = [];
  const found = new Map<string, ErEntity>();

  for (const rule of rules.entities) {
    const entity = findEntity(model, rule.names);
    if (!entity) {
      caseRemarks.push({ message: `В модели нет сущности «${rule.label}».` });
      continue;
    }
    found.set(rule.id, entity);
    for (const attr of rule.attributes ?? []) {
      const names = new Set(attr.names.map(norm));
      if (!entity.attributes.some((a) => names.has(norm(a.name)))) {
        caseRemarks.push({ message: `У сущности «${rule.label}» нет атрибута «${attr.label}».` });
      }
    }
  }

  for (const rel of rules.relations ?? []) {
    const a = found.get(rel.from);
    const b = found.get(rel.to);
    if (!a || !b) continue; // сущности уже отмечены как отсутствующие
    const ok = model.relations.some((r) => relationMatches(r, a.name, b.name, rel.kind));
    if (!ok) {
      const word = rel.kind === "one-to-one" ? "«один к одному»" : "«один ко многим»";
      caseRemarks.push({ message: `Нет связи ${word} «${rel.label}» (слева «один», справа «много» или наоборот по смыслу).` });
    }
  }

  return { ...base, caseRemarks };
}

export const isErCaseSolved = (r: ErCaseResult): boolean =>
  r.syntaxErrors.length === 0 && r.remarks.length === 0 && r.caseRemarks.length === 0;

export type { ErRemark };
