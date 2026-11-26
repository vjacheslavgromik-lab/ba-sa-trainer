import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { getCases, getTheoryParts } from "../../src/content/loader";

const chapter = getTheoryParts("9").find((p) => p.title.startsWith("Документирование API"))!;
const fullText = /```yaml file=(\S+)\n([\s\S]*?)```/.exec(chapter.body);
const shortText = /```yaml\n([\s\S]*?)```/.exec(chapter.body);
const doc = parse(fullText?.[2] ?? "", { strict: true }) as Record<string, any>;
const fragment = parse(shortText?.[1] ?? "") as Record<string, any>;
const case3 = getCases("9").find((c) => c.id === "M9-CASE-03")!;

const METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"];
const operations = Object.entries<any>(doc.paths ?? {}).flatMap(([path, item]) =>
  Object.entries<any>(item)
    .filter(([k]) => METHODS.includes(k))
    .map(([method, op]) => ({ path, method: method.toUpperCase(), op, item })),
);
const resolve = (ref: string): any => ref.replace("#/", "").split("/").reduce((n: any, k) => n?.[k], doc);

describe("Полный пример спецификации API школы (рецензия)", () => {
  it("оформлен как скачиваемый документ school-api.openapi.yaml", () => {
    expect(fullText?.[1]).toBe("school-api.openapi.yaml");
    expect(chapter.body).toContain("### Полный пример: спецификация API школы");
    expect(chapter.body).toContain("Скачать файл");
  });

  it("корневой объект: версия, info, servers, paths, components", () => {
    expect(String(doc.openapi)).toMatch(/^3\.1\./);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
    expect(Array.isArray(doc.servers) && doc.servers.length > 0).toBe(true);
    for (const s of doc.servers) expect(typeof s.url).toBe("string");
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    expect(doc.components.schemas).toBeTruthy();
  });

  it("пять операций школы: методы и адреса совпадают с таблицей из главы 7", () => {
    expect(operations.map((o) => `${o.method} ${o.path}`).sort()).toEqual(
      ["DELETE /enrollments/{id}", "GET /students", "GET /students/{id}", "POST /enrollments", "PUT /students/{id}"].sort(),
    );
  });

  it("operationId заданы и уникальны, теги — массивы строк", () => {
    const ids = operations.map((o) => o.op.operationId);
    for (const id of ids) expect(typeof id).toBe("string");
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of operations) {
      expect(Array.isArray(o.op.tags) && o.op.tags.every((t: unknown) => typeof t === "string")).toBe(true);
    }
  });

  it("параметры пути: на уровне пути или операции, required: true, имя из шаблона, есть schema", () => {
    for (const o of operations) {
      const templates = [...o.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      const params = [...(o.item.parameters ?? []), ...(o.op.parameters ?? [])].filter((p: any) => p.in === "path");
      for (const t of templates) expect(params.map((p: any) => p.name), `${o.method} ${o.path}`).toContain(t);
      for (const p of params) {
        expect(p.required).toBe(true);
        expect(templates).toContain(p.name);
        expect(Boolean(p.schema) !== Boolean(p.content)).toBe(true);
      }
    }
  });

  it("ответы: хотя бы один код, у каждого есть описание; тела запросов с content", () => {
    for (const o of operations) {
      const codes = Object.keys(o.op.responses);
      expect(codes.length, `${o.method} ${o.path}`).toBeGreaterThan(0);
      for (const c of codes) expect(o.op.responses[c].description, `${o.method} ${o.path} ${c}`).toBeTruthy();
      if (o.op.requestBody) {
        expect(o.op.requestBody.content).toBeTruthy();
        expect(o.op.requestBody.required).toBe(true);
      }
    }
  });

  it("все $ref ведут на существующие схемы, схемы с required ссылаются на свои свойства", () => {
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
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(resolve(r), r).toBeTruthy();
    for (const [name, schema] of Object.entries<any>(doc.components.schemas)) {
      for (const field of schema.required ?? []) expect(schema.properties, `${name}.${field}`).toHaveProperty(field);
    }
  });

  it("согласован с кейсом 3: те же операции, коды ответа и обязательные поля тел", () => {
    const rules = case3.postman?.rules.requests ?? [];
    expect(rules.length).toBe(operations.length);
    for (const rule of rules) {
      const o = operations.find((x) => x.method === rule.method && x.path === rule.path);
      expect(o, `${rule.method} ${rule.path}`).toBeTruthy();
      for (const status of rule.statuses ?? []) expect(Object.keys(o!.op.responses), `${rule.method} ${rule.path}`).toContain(String(status));
      if (rule.bodyFields) {
        const schema = o!.op.requestBody.content["application/json"].schema;
        const required: string[] = (schema.$ref ? resolve(schema.$ref) : schema).required;
        for (const f of rule.bodyFields) expect(required, `${rule.method} ${rule.path}`).toContain(f);
      }
    }
  });

  it("совпадает с коротким фрагментом: те же операции и коды ответа, что и выше в главе", () => {
    for (const [path, item] of Object.entries<any>(fragment.paths)) {
      for (const [method, op] of Object.entries<any>(item)) {
        const full = operations.find((x) => x.path === path && x.method === method.toUpperCase());
        expect(full, `${method} ${path}`).toBeTruthy();
        expect(Object.keys(full!.op.responses)).toEqual(Object.keys(op.responses));
      }
    }
  });

  it("схема Student допускает пустой город, как таблица students из модуля 3", () => {
    expect(doc.components.schemas.Student.properties.city.type).toEqual(["string", "null"]);
    expect(doc.components.schemas.Student.required).not.toContain("city");
  });
});
