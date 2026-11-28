import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { parse } from "yaml";
import { getCases } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";
import { checkErCase, isErCaseSolved } from "../../src/features/er/checkErCase";

const cases = getCases("final");
const blocks = (md: string, lang = "text") => [...md.matchAll(new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g"))].map((m) => m[1]);
const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
const REQ_IDS = [...Array.from({ length: 10 }, (_, i) => `ФТ-${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `НФТ-${i + 1}`)];
const STATES = ["Забронирована", "Выдана", "Просрочена", "Возвращена", "Закрыта", "Отменена"];
const STATUS_CODES = ["booked", "issued", "overdue", "returned", "closed", "canceled"];
let engine: SqlJsStatic;

beforeAll(async () => {
  engine = await initSqlJs({ wasmBinary: readFileSync(join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm")) as never });
});

/** Ребра вида «A -> B» и «A -[условие]-> B». */
function edgesOf(text: string) {
  return lines(text)
    .map((l) => /^(\S+) -(?:\[([^\]]+)\])?-?> (\S+)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ from: m[1], label: m[2], to: m[3] }));
}
function reachable(start: string, edges: { from: string; to: string }[]) {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const n = stack.pop()!;
    for (const e of edges.filter((x) => x.from === n)) if (!seen.has(e.to)) { seen.add(e.to); stack.push(e.to); }
  }
  return seen;
}

describe("Выпускной проект: состав кейсов", () => {
  it("шесть кейсов по порядку, без вопросов (gate: none), номер модуля 13", () => {
    expect(cases.map((c) => c.id)).toEqual(Array.from({ length: 6 }, (_, i) => `FINAL-CASE-0${i + 1}`));
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "er", "manual", "manual", "manual"]);
    for (const c of cases) {
      expect(c.gate, c.id).toBe("none");
      expect(c.questions, c.id).toEqual([]);
      expect(c.module, c.id).toBe(13);
      expect(c.title, c.id).toMatch(/^Этап \d\./);
    }
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "final", "cases");
    for (const f of readdirSync(dir)) expect(validateCase(f, JSON.parse(readFileSync(join(dir, f), "utf8"))), f).toEqual([]);
  });

  it("у каждого кейса от 6 чек-листов и пометка «черновик» в эталоне", () => {
    for (const c of cases) {
      expect(c.checklist.length, c.id).toBeGreaterThanOrEqual(6);
      expect(c.reference, c.id).toContain("Эталон (черновик, требует рецензии)");
    }
  });
});

describe("Этап 1: требования", () => {
  const c = cases[0];
  const reqBlock = blocks(c.reference).find((b) => b.startsWith("ID | Требование"))!;

  it("15 требований с идентификаторами по порядку и приоритетами; нефункциональные с числами", () => {
    const rows = lines(reqBlock).slice(1).map((l) => l.split("|").map((x) => x.trim()));
    expect(rows.map((r) => r[0])).toEqual(REQ_IDS);
    for (const r of rows) {
      expect(["обязательно", "важно", "желательно"], r[0]).toContain(r[2]);
      expect(r[1].length, r[0]).toBeGreaterThan(20);
    }
    for (const id of ["НФТ-1", "НФТ-2", "НФТ-3", "НФТ-5"]) expect(rows.find((r) => r[0] === id)![1], id).toMatch(/\d/);
    expect(rows.find((r) => r[0] === "НФТ-4")![1]).toContain("в России");
  });

  it("правила протокола отражены в требованиях: 30 суток, 2 часа, 150%, залог", () => {
    for (const w of ["2 часов", "30%", "150%", "30 суток"]) expect(c.condition, w).toContain(w);
    const rows = lines(reqBlock);
    expect(rows.find((l) => l.startsWith("ФТ-2"))).toContain("30 суток");
    expect(rows.find((l) => l.startsWith("ФТ-4"))).toContain("2 часа");
    expect(rows.find((l) => l.startsWith("ФТ-7"))).toContain("150%");
  });

  it("цели протокола с числами повторены в критериях успеха: 5 минут, 50%, 30%", () => {
    for (const w of ["5 минут", "50%", "30%"]) {
      expect(c.condition, w).toContain(w);
      expect(c.reference, w).toContain(w);
    }
  });

  it("три открытых вопроса из протокола (не решено) перечислены в эталоне", () => {
    const open = [...c.condition.matchAll(/^- (.+) \(не решено\)\.$/gm)].map((m) => m[1]);
    expect(open).toHaveLength(3);
    const tail = c.reference.slice(c.reference.indexOf("**Допущения и открытые вопросы:**"));
    for (const key of ["детского снаряжения", "постоянным клиентам", "кассой"]) {
      expect(open.some((q) => q.includes(key)), `протокол: ${key}`).toBe(true);
      expect(tail, `эталон: ${key}`).toContain(key.replace("кассой", "кассой"));
    }
  });

  it("12 вопросов заказчику в четырёх группах; три истории, у каждой не менее двух сценариев «Дано / Когда / Тогда»", () => {
    const qs = blocks(c.reference).find((b) => b.startsWith("Цели"))!;
    expect(lines(qs).filter((l) => /^\d+\) /.test(l))).toHaveLength(12);
    for (const g of ["Цели", "Пользователи", "Правила", "Системы и ограничения"]) expect(qs).toContain(g);
    const stories = blocks(c.reference).find((b) => b.startsWith("История ФТ-2"))!;
    expect((stories.match(/^История ФТ-\d/gm) ?? [])).toHaveLength(3);
    expect((stories.match(/Сценарий «/g) ?? []).length).toBeGreaterThanOrEqual(6);
    for (const w of ["Дано", "Когда", "Тогда"]) expect((stories.match(new RegExp(w, "g")) ?? []).length, w).toBeGreaterThanOrEqual(6);
  });
});

describe("Этап 2: процессы", () => {
  const text = blocks(cases[1].reference)[0];
  const [nodesPart, rest] = text.split("Потоки");
  const nodes = lines(nodesPart).slice(1).map((l) => l.split("|").map((x) => x.trim()));
  const flows = edgesOf(rest.split("Покрытие требований")[0]);

  it("узлы: идентификатор, одна из трёх дорожек, описание; есть старт и два финиша", () => {
    for (const n of nodes) {
      expect(n).toHaveLength(3);
      expect(["Клиент", "Продавец", "Система"], n[0]).toContain(n[1]);
    }
    const ids = nodes.map((n) => n[0]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("Старт");
    expect(ids.filter((i) => i.startsWith("Финиш"))).toHaveLength(2);
    expect(new Set(nodes.map((n) => n[1]))).toEqual(new Set(["Клиент", "Продавец", "Система"]));
  });

  it("потоки соединяют объявленные узлы, шлюзы имеют не менее двух подписанных выходов, все узлы достижимы из старта, у не конечных есть выход", () => {
    const ids = new Set(nodes.map((n) => n[0]));
    for (const e of flows) {
      expect(ids.has(e.from), e.from).toBe(true);
      expect(ids.has(e.to), e.to).toBe(true);
    }
    for (const n of nodes.filter((n) => n[0].startsWith("Ш"))) {
      const out = flows.filter((e) => e.from === n[0]);
      expect(out.length, n[0]).toBeGreaterThanOrEqual(2);
      for (const e of out) expect(e.label, `${n[0]} -> ${e.to}`).toBeTruthy();
    }
    expect(reachable("Старт", flows)).toEqual(ids);
    for (const n of nodes.filter((n) => !n[0].startsWith("Финиш"))) expect(flows.some((e) => e.from === n[0]), `у ${n[0]} нет выхода`).toBe(true);
    expect(flows.some((e) => e.from === "Ш1" && e.to === "К1" && e.label === "нет")).toBe(true);
  });

  it("покрытие: ФТ-1…ФТ-8 закрыты существующими шагами", () => {
    const ids = new Set(nodes.map((n) => n[0]));
    const cover = lines(text.split("Покрытие требований")[1]);
    expect(cover.map((l) => l.split(":")[0])).toEqual(REQ_IDS.slice(0, 8));
    for (const l of cover) for (const s of l.split(":")[1].split(",").map((x) => x.trim())) expect(ids.has(s), `${l} → ${s}`).toBe(true);
  });

  it("состояния аренды: шесть, все достижимы из «Забронирована», конечные «Отменена» и «Закрыта»", () => {
    const part = blocks(cases[1].reference)[1];
    const trans = lines(part).slice(1).map((l) => /^(.+?) -> (.+?) \(/.exec(l)!).map((m) => ({ from: m[1], to: m[2] }));
    expect(trans).toHaveLength(6);
    const all = new Set(trans.flatMap((t) => [t.from, t.to]));
    expect(all).toEqual(new Set(STATES));
    expect(reachable("Забронирована", trans)).toEqual(all);
    const terminal = [...all].filter((s) => !trans.some((t) => t.from === s));
    expect(terminal.sort()).toEqual(["Закрыта", "Отменена"]);
    for (const code of STATUS_CODES) expect(cases[1].reference).toContain(code);
  });
});

describe("Этап 3: данные", () => {
  const c = cases[2];
  const source = blocks(c.reference).find((b) => b.startsWith("erDiagram"))!;

  it("эталонная ER-диаграмма проходит проверку тренажёра и правил кейса без замечаний", () => {
    const result = checkErCase(source, c.er!.rules);
    expect(result.syntaxErrors).toEqual([]);
    expect(result.remarks.map((r) => r.message)).toEqual([]);
    expect(result.caseRemarks).toEqual([]);
    expect(isErCaseSolved(result)).toBe(true);
  });

  it("не принимается диаграмма без связей пункта проката и штрафа", () => {
    const noPoint = source.replace(/^\s*POINT \|\|--o\{ (RENTAL|EQUIPMENT).*$/gm, "");
    expect(checkErCase(noPoint, c.er!.rules).caseRemarks.map((r) => r.message).join(" ")).toContain("Пункт проката");
    const noPenalty = source.replace(/^\s*RENTAL_ITEM \|\|--o\{ PENALTY.*$/gm, "");
    expect(checkErCase(noPenalty, c.er!.rules).caseRemarks.map((r) => r.message).join(" ")).toContain("Штраф");
  });

  it("SQL-скрипт выполняется, запросы дают результат, указанный в эталоне", () => {
    const [setup, overdue, busy] = blocks(c.reference, "sql");
    const db = new engine.Database();
    try {
      db.exec(setup);
      expect(db.exec(overdue)[0].values).toEqual([["Вера", "+79007778899", 3, "2027-04-25"]]);
      expect(db.exec(busy)[0].values.flat()).toEqual(["R-001", "S-001", "T-001"]);
      const statuses = db.exec("SELECT DISTINCT status FROM rental")[0].values.flat();
      for (const s of statuses) expect(STATUS_CODES).toContain(s);
    } finally {
      db.close();
    }
  });

  it("словарь данных: пять строк, статусы совпадают с процессом", () => {
    const rows = c.reference.split("\n").filter((l) => /^\| (Аренда|Единица): /.test(l));
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain(STATUS_CODES.join(", "));
  });
});

describe("Этап 4: прототип", () => {
  const c = cases[3];
  it("карта экранов: с сайта из «Каталога» достижимы все экраны, у продавца из «Входа» — все его экраны", () => {
    const raw = lines(blocks(c.reference).find((b) => b.includes("Каталог -> Карточка"))!).map((l) => l.split(" -> "));
    const e = raw.map(([from, to]) => ({ from, to }));
    expect(e).toHaveLength(15);
    const site = e.slice(0, 11);
    const seller = e.slice(11);
    const siteScreens = new Set(site.flatMap((x) => [x.from, x.to]));
    expect(reachable("Каталог", site)).toEqual(siteScreens);
    const sellerScreens = new Set(seller.flatMap((x) => [x.from, x.to]));
    expect(reachable("Вход продавца", seller)).toEqual(sellerScreens);
    for (const s of ["Бронь создана", "Ошибка оплаты", "Нет свободных единиц"]) expect(siteScreens.has(s), s).toBe(true);
  });

  it("главный экран: не менее 9 элементов с типом, обязательностью и правилами; правила дат и состояния экрана", () => {
    const table = blocks(c.reference).find((b) => b.startsWith("Элемент |"))!;
    const rows = lines(table).slice(1).map((l) => l.split("|").map((x) => x.trim()));
    expect(rows.length).toBeGreaterThanOrEqual(9);
    for (const r of rows) {
      expect(r, r[0]).toHaveLength(4);
      for (const cell of r) expect(cell.length, r[0]).toBeGreaterThan(0);
    }
    expect(table).toContain("30 суток");
    expect(table).toContain("1 сутки");
    for (const w of ["загрузка", "пусто", "ошибка"]) expect(c.reference).toContain(w);
  });

  it("две персоны с числовыми требованиями: 3 минуты и 5 минут", () => {
    const rows = c.reference.split("\n").filter((l) => /^\| (Анна|Игорь),/.test(l));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("3 минуты");
    expect(rows[1]).toContain("5 минут");
  });
});

describe("Этап 5: интеграции и API", () => {
  const c = cases[4];
  const api = parse(blocks(c.reference, "yaml")[0]) as Record<string, any>;

  it("OpenAPI разбирается; три операции с уникальными operationId; создание брони возвращает 201 и 409", () => {
    expect(String(api.openapi)).toBe("3.1.1");
    const ids: string[] = [];
    for (const item of Object.values<any>(api.paths)) for (const op of Object.values<any>(item)) if (op?.operationId) ids.push(op.operationId);
    expect(ids.sort()).toEqual(["createRental", "getAvailability", "returnRental"]);
    expect(Object.keys(api.paths["/rentals"].post.responses)).toEqual(["201", "400", "409"]);
    expect(Object.keys(api.paths["/rentals/{rentalId}/return"].post.responses)).toContain("409");
  });

  it("все ссылки $ref ведут на существующие компоненты, параметры пути объявлены, обязательные поля описаны", () => {
    const refs: string[] = [];
    const walk = (n: unknown) => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === "object") {
        for (const [k, v] of Object.entries(n)) {
          if (k === "$ref") refs.push(String(v));
          else walk(v);
        }
      }
    };
    walk(api);
    expect(refs.length).toBeGreaterThan(10);
    for (const r of refs) {
      let cur: any = api;
      for (const seg of r.replace(/^#\//, "").split("/")) cur = cur?.[seg];
      expect(cur, r).toBeDefined();
    }
    for (const [path, item] of Object.entries<any>(api.paths)) {
      const op = Object.values<any>(item).find((o) => o?.operationId);
      const declared = (op.parameters ?? []).map((p: any) => (p.$ref ? api.components.parameters[p.$ref.split("/").pop()].name : p.name));
      for (const seg of path.matchAll(/\{(\w+)\}/g)) expect(declared, `${path} ${seg[1]}`).toContain(seg[1]);
    }
    for (const name of ["Availability", "RentalRequest", "Error"]) {
      const s = api.components.schemas[name];
      for (const r of s.required) expect(Object.keys(s.properties), `${name}.${r}`).toContain(r);
    }
  });

  it("статусы в API совпадают с процессом и данными; имена полей согласованы с ER", () => {
    expect(api.components.schemas.Rental.allOf[1].properties.status.enum).toEqual(STATUS_CODES);
    const mapping = blocks(c.reference).find((b) => b.startsWith("Забронирована = booked"))!;
    expect(lines(mapping).map((l) => l.split(" = ")[1])).toEqual(STATUS_CODES);
    const props = Object.keys(api.components.schemas.RentalRequest.properties);
    const camel = (s: string) => s.replace(/_(\w)/g, (_, ch: string) => ch.toUpperCase());
    for (const col of ["start_at", "end_at", "customer_id", "point_id"]) expect(props, col).toContain(camel(col));
    const er = blocks(cases[2].reference).find((b) => b.startsWith("erDiagram"))!;
    for (const col of ["start_at", "end_at", "customer_id", "point_id"]) expect(er, col).toContain(col);
  });

  it("интеграция с платёжным шлюзом: три операции, у каждой ошибка и действие; сказано про валидатор и повтор запроса", () => {
    const table = blocks(c.reference).find((b) => b.startsWith("Операция | Когда"))!;
    const rows = lines(table).slice(1).map((l) => l.split("|").map((x) => x.trim()));
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r).toHaveLength(5);
      expect(r[4].length, r[0]).toBeGreaterThan(15);
    }
    expect(c.reference).toContain("валидатор");
    expect(c.reference).toContain("ключом платежа");
  });
});

describe("Этап 6: ПМИ и презентация", () => {
  const c = cases[5];
  const pmi = blocks(c.reference)[0];

  it("ПМИ покрывает все 15 требований этапа 1, способы из четырёх, критерии непустые", () => {
    const rows = lines(pmi).slice(1).map((l) => l.split("|").map((x) => x.trim()));
    expect(rows.map((r) => r[0])).toEqual(REQ_IDS);
    for (const r of rows) {
      expect(["тестирование", "экспертиза", "демонстрация", "анализ"], r[0]).toContain(r[1]);
      expect(r[2].length, r[0]).toBeGreaterThan(10);
      expect(r[3].length, r[0]).toBeGreaterThan(10);
    }
    const firstStage = blocks(cases[0].reference).find((b) => b.startsWith("ID | Требование"))!;
    expect(lines(firstStage).slice(1).map((l) => l.split("|")[0].trim())).toEqual(rows.map((r) => r[0]));
  });

  it("критерии ПМИ совпадают с числами требований: 2 секунды, 200, 99,5%, 5 минут, 300% за двое суток", () => {
    const row = (id: string) => lines(pmi).find((l) => l.startsWith(id))!;
    expect(row("НФТ-1")).toMatch(/200.*2 секунд/);
    expect(row("НФТ-2")).toContain("5 минут");
    expect(row("НФТ-3")).toContain("99,5%");
    expect(row("ФТ-7")).toContain("300%");
    expect(row("ФТ-4")).toContain("2 часа");
  });

  it("критерий приёмки с критичными требованиями; в нём названы ФТ-2, ФТ-5, ФТ-6, НФТ-5", () => {
    const line = c.reference.split("\n").find((l) => l.startsWith("**Критерий приёмки системы:**"))!;
    for (const id of ["ФТ-2", "ФТ-5", "ФТ-6", "НФТ-5"]) expect(line, id).toContain(id);
    expect(line).toContain("не менее 95%");
  });

  it("презентация: семь слайдов, у каждого сообщение и решение заказчика; цели с числами повторены", () => {
    const slides = lines(blocks(c.reference).find((b) => /^1\) /.test(b.trim()))!);
    expect(slides).toHaveLength(7);
    slides.forEach((s, i) => {
      expect(s.startsWith(`${i + 1}) `)).toBe(true);
      expect(s).toContain("— Решение:");
      expect(s.split("—")).toHaveLength(3);
    });
    for (const w of ["5 минут", "50%", "30%", "4 месяца"]) expect(c.reference, w).toContain(w);
  });
});
