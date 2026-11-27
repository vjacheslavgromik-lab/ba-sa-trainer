import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { getTheoryParts } from "../../src/content/loader";

const parts = getTheoryParts("12");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/12/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");
const blocks = (md: string, lang: string) => [...md.matchAll(new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g"))].map((m) => m[1]);

describe("Теория модуля 12: порядок и состав", () => {
  it("десять глав по порядку: от требований к архитектуре до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Требования к архитектуре системы",
      "Шаблоны микросервисной архитектуры",
      "Событийно-ориентированная архитектура",
      "Шаблоны событийно-ориентированной архитектуры",
      "Нотация C4",
      "Domain-Driven Design",
      "Моделирование и высокоуровневое проектирование API",
      "Стили API: Query-based и AsyncAPI",
      "Проектирование спецификации OpenAPI на YAML",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты", () => {
    const all = parts.map((p) => p.body).join("\n").toLowerCase();
    for (const phrase of [
      "атрибуты качества", "компромисс", "сага", "шлюз api", "размыкатель цепи", "база на сервис",
      "событие", "event sourcing", "outbox", "идемпотентн", "контейнер", "контекст системы",
      "ограниченный контекст", "агрегат", "единый язык", "graphql", "asyncapi", "openapi", "$ref",
    ]) {
      expect(all, phrase).toContain(phrase);
    }
  });

  it("в каждой главе (кроме словаря) есть цель, проверочные вопросы, итоги и источник", () => {
    for (const p of parts.slice(0, -1)) {
      expect(p.body, p.title).toContain("**Цель главы.**");
      expect(p.body, p.title).toContain("## Проверьте себя");
      expect(p.body, p.title).toContain("## Итоги");
    }
    for (const src of sources) expect(src).not.toBe("");
  });

  it("ссылки на источники: страницы книг для глав по книгам, адреса для открытых источников", () => {
    expect(parts[0].body).toMatch(/с\. 235/);
    expect(parts[0].body).toMatch(/с\. 24[89]/);
    expect(parts[0].body).toMatch(/с\. 250/);
    expect(parts[2].body).toMatch(/с\. 87/);
    expect(parts[2].body).toMatch(/с\. 174/);
    expect(parts[3].body).toMatch(/с\. 541/);
    for (const i of [1, 2, 3, 4, 5, 8]) expect(sources[i], `глава ${i + 1}`).toMatch(/https:\/\//);
    expect(sources[4]).toContain("CC BY 4.0");
  });

  it("оговорки об источниках на месте", () => {
    expect(sources[3]).toContain("черновик");
    expect(parts[3].body).toContain("помечена им как черновик");
    expect(sources[5]).toContain("не перечисляются");
    expect(sources[7]).toContain("не читались");
    expect(sources[8]).toContain("не дословно");
    expect(parts[6].body.toLowerCase()).toContain("рабочая схема курса");
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 12: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["API", "Application Programming Interface"],
    ["HTTP", "HyperText Transfer Protocol"],
    ["JSON", "JavaScript Object Notation"],
    ["REST", "Representational State Transfer"],
    ["CQRS", "Command Query Responsibility Segregation"],
    ["CRUD", "Create, Read, Update, Delete"],
    ["DDD", "Domain-Driven Design"],
    ["EDA", "Event-Driven Architecture"],
    ["BFF", "Backends for frontends"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])`);
      for (let i = 0; i < parts.length - 1; i++) {
        const text = prose(parts[i].body);
        const m = re.exec(text);
        if (!m) continue;
        expect(text.slice(Math.max(0, m.index - 150), m.index + 450), `глава ${i + 1}`).toContain(full);
        return;
      }
      throw new Error(`${abbr} не найден`);
    });
  }

  it("словарь содержит все сокращения", () => {
    const glossary = parts[parts.length - 1].body;
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toMatch(new RegExp(`\\| ${abbr} \\|`));
  });
});

describe("Теория модуля 12: примеры", () => {
  it("сага «Виты»: у каждого шага есть сервис и компенсация", () => {
    const rows = parts[1].body.split("\n").filter((l) => /^\| [1-4]\. /.test(l));
    expect(rows.length).toBe(4);
    for (const r of rows) {
      const cells = r.split("|").map((c) => c.trim()).filter(Boolean);
      expect(cells.length, r).toBe(3);
      expect(cells[2].length, r).toBeGreaterThan(5);
    }
  });

  it("события «Виты»: JSON разбирается, перенос состояния содержит всё из оповещения", () => {
    const [notification, carried] = blocks(parts[3].body, "json").map((b) => JSON.parse(b) as Record<string, string>);
    expect(Object.keys(notification).length).toBeLessThan(Object.keys(carried).length);
    for (const [k, v] of Object.entries(notification)) expect(carried[k], k).toBe(v);
    expect(carried.eventType).toBe("AppointmentBooked");
    expect(carried.eventId).toBeTruthy();
  });

  it("C4: на диаграмме контекста нет баз, на диаграмме контейнеров базы только принимают связи", () => {
    const [context, containers] = blocks(parts[4].body, "text");
    const edges = (t: string) => [...t.matchAll(/\[([^\]]+)\]\s*-->\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2]] as const);
    const ctx = edges(context);
    expect(ctx.length).toBe(5);
    for (const [a, b] of ctx) expect(`${a} ${b}`).not.toMatch(/База/);
    const cont = edges(containers);
    expect(cont.length).toBe(11);
    for (const [a] of cont) expect(a).not.toMatch(/^База/);
    const dbs = new Set(cont.map(([, b]) => b).filter((b) => /^База/.test(b)));
    expect(dbs.size).toBe(2);
    // у каждого сервиса своя база: в одну базу ведёт ровно один сервис
    for (const db of dbs) expect(cont.filter(([, b]) => b === db).length, db).toBe(1);
    // сервисы не ходят в чужие базы
    const owner = new Map(cont.filter(([a, b]) => /^Сервис/.test(a) && /^База/.test(b)).map(([a, b]) => [b, a]));
    expect(owner.size).toBe(2);
  });

  it("карта контекстов «Виты» не содержит циклов", () => {
    const block = blocks(parts[5].body, "text")[0];
    const edges = [...block.matchAll(/\[([^\]]+)\]\s*-->\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2]] as const);
    expect(edges.length).toBe(4);
    const graph = new Map<string, string[]>();
    for (const [a, b] of edges) graph.set(a, [...(graph.get(a) ?? []), b]);
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
    expect([...graph.keys()].some(visit)).toBe(false);
  });

  it("GraphQL: поля запроса есть в схеме", () => {
    const [schema, query] = blocks(parts[7].body, "graphql");
    expect(schema).toContain("type Query");
    for (const field of ["id", "slotStart", "doctor", "clinic", "name", "myAppointments"]) expect(schema, field).toContain(field);
    expect(query).toContain("myAppointments");
    expect(schema).toMatch(/myAppointments\(patientId: ID!/);
  });

  it("AsyncAPI: операции ссылаются на существующие каналы, обязательные поля описаны", () => {
    const doc = parse(blocks(parts[7].body, "yaml")[0]) as Record<string, any>;
    expect(String(doc.asyncapi)).toMatch(/^3\./);
    for (const op of Object.values<any>(doc.operations)) {
      expect(["send", "receive"]).toContain(op.action);
      const name = String(op.channel.$ref).replace("#/channels/", "");
      expect(doc.channels[name], name).toBeDefined();
    }
    for (const ch of Object.values<any>(doc.channels)) {
      for (const msg of Object.values<any>(ch.messages)) {
        const props = Object.keys(msg.payload.properties);
        for (const r of msg.payload.required) expect(props, r).toContain(r);
      }
    }
  });

  it("OpenAPI «Виты»: ссылки ведут на существующие компоненты, operationId уникальны, у операций есть ответы", () => {
    const doc = parse(blocks(parts[8].body, "yaml")[0]) as Record<string, any>;
    expect(String(doc.openapi)).toBe("3.1.1");
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
    walk(doc);
    expect(refs.length).toBeGreaterThan(8);
    for (const r of refs) {
      const path = r.replace(/^#\//, "").split("/");
      let cur: any = doc;
      for (const seg of path) cur = cur?.[seg];
      expect(cur, r).toBeDefined();
    }
    const ids: string[] = [];
    for (const [path, item] of Object.entries<any>(doc.paths)) {
      const declared = (item.parameters ?? []).map((p: any) => (p.$ref ? doc.components.parameters[p.$ref.split("/").pop()].name : p.name));
      for (const seg of path.matchAll(/\{(\w+)\}/g)) expect(declared, `${path} ${seg[1]}`).toContain(seg[1]);
      for (const [method, op] of Object.entries<any>(item)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        ids.push(op.operationId);
        expect(Object.keys(op.responses).length, `${method} ${path}`).toBeGreaterThan(0);
      }
    }
    expect(ids.length).toBe(3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("OpenAPI «Виты»: обязательные поля схем описаны в properties, статусы согласованы с главой 7", () => {
    const doc = parse(blocks(parts[8].body, "yaml")[0]) as Record<string, any>;
    const schemas = doc.components.schemas;
    for (const name of ["AppointmentRequest", "Error"]) {
      for (const r of schemas[name].required) expect(Object.keys(schemas[name].properties), `${name}.${r}`).toContain(r);
    }
    expect(schemas.Appointment.allOf[1].properties.status.enum).toEqual(["booked", "canceled"]);
    expect(parts[6].body).toContain("409 Conflict");
    expect(Object.keys(doc.paths["/appointments"].post.responses)).toContain("409");
  });
});
