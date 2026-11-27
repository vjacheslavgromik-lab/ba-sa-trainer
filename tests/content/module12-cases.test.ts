import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("12");
const blocks = (md: string, lang = "text") => [...md.matchAll(new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g"))].map((m) => m[1]);
const edges = (t: string) => [...t.matchAll(/\[([^\]]+)\]\s*-->\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2]] as const);
const hasCycle = (es: readonly (readonly [string, string])[]) => {
  const graph = new Map<string, string[]>();
  for (const [a, b] of es) graph.set(a, [...(graph.get(a) ?? []), b]);
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (n: string): boolean => {
    if (done.has(n)) return false;
    if (visiting.has(n)) return true;
    visiting.add(n);
    const cyc = (graph.get(n) ?? []).some(visit);
    visiting.delete(n);
    done.add(n);
    return cyc;
  };
  return [...graph.keys()].some(visit);
};

describe("Кейсы модуля 12", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M12-CASE-01", "M12-CASE-02", "M12-CASE-03", "M12-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "12", "cases");
    for (const f of readdirSync(dir)) expect(validateCase(f, JSON.parse(readFileSync(join(dir, f), "utf8"))), f).toEqual([]);
  });

  it("24 вопроса: по шесть на кейс, не повторяются, у каждого четыре разных варианта", () => {
    const ids = cases.flatMap((c) => c.questions);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    for (const c of cases) expect(c.questions).toHaveLength(6);
    for (const id of ids) {
      const q = getQuestion(id)!;
      expect(q, id).toBeTruthy();
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.theoryRef, id).toMatch(/глава \d+/);
    }
  });

  it("вопросы охватывают главы 1–9 теории", () => {
    const refs = cases.flatMap((c) => c.questions).map((id) => getQuestion(id)!.theoryRef);
    for (let chapter = 1; chapter <= 9; chapter++) {
      expect(refs.some((r) => new RegExp(`глава ${chapter}(?!\\d)`).test(r)), `глава ${chapter}`).toBe(true);
    }
  });

  it("правильные ответы распределены по всем четырём позициям поровну", () => {
    const counts = [0, 0, 0, 0];
    for (const id of cases.flatMap((c) => c.questions)) counts[getQuestion(id)!.correct]++;
    expect(counts).toEqual([6, 6, 6, 6]);
  });

  it("правильный ответ не выделяется длиной: самым длинным он бывает не чаще чем в 40% вопросов", () => {
    const ids = cases.flatMap((c) => c.questions);
    const longest = ids.filter((id) => {
      const q = getQuestion(id)!;
      const lengths = q.options.map((o) => o.length);
      return lengths.indexOf(Math.max(...lengths)) === q.correct;
    });
    expect(longest.length / ids.length).toBeLessThanOrEqual(0.4);
  });

  it("правильный ответ не бывает и систематически самым коротким: не чаще чем в 40% вопросов", () => {
    const ids = cases.flatMap((c) => c.questions);
    const shortest = ids.filter((id) => {
      const q = getQuestion(id)!;
      const lengths = q.options.map((o) => o.length);
      return lengths.indexOf(Math.min(...lengths)) === q.correct;
    });
    expect(shortest.length / ids.length).toBeLessThanOrEqual(0.4);
  });
});

describe("Эталоны кейсов модуля 12", () => {
  it("кейс 1 (требования): четыре значимых требования с числами, пятое не значимо; решения из глав 2–4; названы компромиссы", () => {
    const c = cases[0];
    const rows = blocks(c.reference)[0].split("\n").filter((l) => /^АТ-\d/.test(l)).map((l) => l.split("|").map((x) => x.trim()));
    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r).toHaveLength(6);
    const significant = rows.filter((r) => r[1] === "да");
    expect(significant).toHaveLength(4);
    for (const r of significant) {
      expect(r[2], r[0]).toMatch(/\d/);
      expect(r[4].length, r[0]).toBeGreaterThan(5);
      expect(r[5].length, r[0]).toBeGreaterThan(5);
    }
    const [at1, at2, at3, at4, at5] = rows;
    expect(at1[3]).toContain("кэш");
    expect(at2[3]).toContain("Сага");
    expect(at3[3]).toContain("Размыкатель");
    expect(at4[3]).toContain("База на сервис");
    expect(at5[1]).toBe("нет");
    expect(at5[2]).toBe("—");
    expect(at1[2]).toMatch(/95%/);
    expect(at1[2]).toMatch(/500/);
    expect(c.reference).toContain("Компромисс");
    expect(c.condition.match(/^- «/gm)).toHaveLength(5);
  });

  it("кейс 2 (сага): четыре шага с компенсациями, откат в обратном порядке, статусы достижимы, события полны", () => {
    const c = cases[1];
    const text = blocks(c.reference)[0];
    const steps = text.split("\n").filter((l) => /^[1-4] \| /.test(l)).map((l) => l.split("|").map((x) => x.trim()));
    expect(steps).toHaveLength(4);
    for (const s of steps) {
      expect(s).toHaveLength(4);
      expect(s[3].length).toBeGreaterThan(5);
    }
    const failures = text.split("\n").filter((l) => /^[А-В]\. /.test(l)).map((l) => l.split("|").map((x) => x.trim()));
    expect(failures).toHaveLength(3);
    for (const [name, done, comp] of failures) {
      const range = /шаги (\d)–(\d)/.exec(done)!;
      const last = Number(range[2]);
      const mentioned = [...comp.matchAll(/шаг (\d)/g)].map((m) => Number(m[1]));
      expect(mentioned.length, name).toBe(last);
      expect(mentioned, name).toEqual([...mentioned].sort((a, b) => b - a));
      expect(Math.max(...mentioned), name).toBe(last);
      expect(comp, name).toContain("уведомить пациента");
    }
    expect(failures[2][2]).toContain("предоплата возвращена");

    const transitions = [...text.matchAll(/^(.+?) -> (.+?) \(/gm)].map((m) => [m[1], m[2]] as const);
    expect(transitions).toHaveLength(4);
    const reach = new Set(["создана"]);
    for (let i = 0; i < transitions.length; i++) for (const [a, b] of transitions) if (reach.has(a)) reach.add(b);
    const states = new Set(transitions.flatMap(([a, b]) => [a, b]));
    expect(reach).toEqual(states);
    expect(transitions.filter(([a]) => a === "отменена")).toHaveLength(0);

    const events = [...text.matchAll(/^([А-Я][А-Яа-яё]+) — (расписание|записи|платежи)$/gm)].map((m) => ({ name: m[1], owner: m[2] }));
    expect(events).toHaveLength(8);
    expect(new Set(events.map((e) => e.name)).size).toBe(8);
    for (const needed of ["СлотОсвобождён", "ЗаписьОтменена", "ПредоплатаВозвращена"]) expect(events.map((e) => e.name), needed).toContain(needed);
    expect(c.reference).toContain("eventId");
    expect(c.reference).toContain("оркестрация");
  });

  it("кейс 3 (C4 и DDD): на контексте нет баз, у каждой базы один владелец, контексты без циклов, агрегат с корнем", () => {
    const c = cases[2];
    const [context, containers, map, aggregate] = blocks(c.reference);
    const ctx = edges(context);
    expect(ctx).toHaveLength(5);
    for (const [a, b] of ctx) expect(`${a} ${b}`).not.toMatch(/База|Сервис|Шлюз API|Брокер/);

    const cont = edges(containers);
    expect(cont).toHaveLength(11);
    for (const [a] of cont) expect(a).not.toMatch(/^База/);
    const dbs = [...new Set(cont.map(([, b]) => b).filter((b) => /^База/.test(b)))];
    expect(dbs).toHaveLength(2);
    for (const db of dbs) expect(cont.filter(([, b]) => b === db).length, db).toBe(1);

    const contexts = [...c.reference.matchAll(/^\| (Расписание|Запись|Платежи|Медицинская карта) \| (.+) \|$/gm)].map((m) => m[1]);
    expect(contexts).toEqual(["Расписание", "Запись", "Платежи", "Медицинская карта"]);
    const links = edges(map);
    expect(links).toHaveLength(3);
    for (const [a, b] of links) {
      expect(contexts, a).toContain(a);
      expect(contexts, b).toContain(b);
    }
    expect(hasCycle(links)).toBe(false);

    expect(aggregate).toContain("Корень: Запись");
    expect(aggregate).toContain("Услуга записи");
    expect(aggregate).toContain("идентификатор слота");
    expect((aggregate.match(/нельзя/g) ?? []).length).toBe(2);
    expect(c.reference).toContain("не является программной системой");
    for (const word of ["регистратор", "пациент", "бухгалтер", "врач"]) expect(c.condition.toLowerCase(), word).toContain(`- ${word}: «приём`);
  });

  it("кейс 4 (API): OpenAPI разбирается, ссылки целы, параметры объявлены; AsyncAPI содержит все поля события", () => {
    const c = cases[3];
    const [openapiText, asyncText] = blocks(c.reference, "yaml");
    const api = parse(openapiText) as Record<string, any>;
    expect(String(api.openapi)).toBe("3.1.1");
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
    expect(refs.length).toBeGreaterThanOrEqual(5);
    for (const r of refs) {
      let cur: any = api;
      for (const seg of r.replace(/^#\//, "").split("/")) cur = cur?.[seg];
      expect(cur, r).toBeDefined();
    }
    const [path, item] = Object.entries<any>(api.paths)[0];
    for (const seg of path.matchAll(/\{(\w+)\}/g)) {
      const declared = item.get.parameters.map((p: any) => (p.$ref ? api.components.parameters[p.$ref.split("/").pop()].name : p.name));
      expect(declared, seg[1]).toContain(seg[1]);
    }
    expect(Object.keys(item.get.responses)).toEqual(["200", "400", "404"]);
    for (const name of ["Slot", "Error"]) {
      const s = api.components.schemas[name];
      for (const r of s.required) expect(Object.keys(s.properties), `${name}.${r}`).toContain(r);
    }

    const async = parse(asyncText) as Record<string, any>;
    expect(String(async.asyncapi)).toMatch(/^3\./);
    const ops = Object.values<any>(async.operations);
    expect(ops.map((o) => o.action).sort()).toEqual(["receive", "send"]);
    for (const op of ops) expect(async.channels[String(op.channel.$ref).replace("#/channels/", "")]).toBeDefined();
    const payload = Object.values<any>(Object.values<any>(async.channels)[0].messages)[0].payload;
    for (const field of ["eventId", "appointmentId", "patientId", "slotStart"]) {
      expect(Object.keys(payload.properties), field).toContain(field);
      expect(payload.required, field).toContain(field);
    }
    expect(c.condition).toContain("идентификатор события");
    expect(c.reference).toContain("валидатор");
  });
});
