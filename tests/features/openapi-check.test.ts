import { describe, it, expect } from "vitest";
import { checkOpenApi, type OpenApiRule } from "../../src/features/openapi/checkOpenApi";
import { GOOD_SAMPLE, BAD_SAMPLE } from "../../src/features/openapi/OpenApiTrainerView";
import { getTheoryParts } from "../helpers/theory";
import { getCases } from "../../src/content/loader";

const rules = (src: string): OpenApiRule[] => checkOpenApi(src).remarks.map((r) => r.rule);
const yamlBlocks = (md: string) => [...md.matchAll(/```yaml(?: file=\S+)?\n([\s\S]*?)```/g)].map((m) => m[1]);

const MIN = `openapi: 3.1.1
info:
  title: Тест
  version: 1.0.0
paths:
  /items:
    get:
      operationId: listItems
      responses:
        '200':
          description: Список
        '404':
          description: Не найдено
`;

describe("проверка OpenAPI: корректные документы", () => {
  it("корректный пример тренажёра проходит без замечаний: два пути, две операции", () => {
    const r = checkOpenApi(GOOD_SAMPLE);
    expect(r.syntaxErrors).toEqual([]);
    expect(r.remarks).toEqual([]);
    expect(r.stats).toEqual({ paths: 2, operations: 2 });
  });

  it("минимальный документ проходит", () => {
    expect(checkOpenApi(MIN).remarks).toEqual([]);
  });

  it("принимает версию числом и внешние ссылки не считает ошибкой", () => {
    expect(rules(MIN.replace("3.1.1", "3.1"))).toEqual([]);
    const ext = MIN.replace("description: Список", "$ref: 'other.yaml#/components/responses/List'");
    expect(rules(ext)).toEqual([]);
  });

  it("все спецификации OpenAPI из теории и кейсов курса проходят проверку без замечаний", () => {
    const sources: { where: string; text: string }[] = [];
    for (const id of ["8", "9", "12"]) {
      for (const [i, p] of getTheoryParts(id).entries()) {
        // Короткие учебные фрагменты (структура документа без operationId) — не готовые спецификации: их не проверяем.
        for (const text of yamlBlocks(p.body)) if (/^openapi:/m.test(text) && /operationId:/.test(text)) sources.push({ where: `теория ${id}, глава ${i + 1}`, text });
      }
    }
    for (const id of ["9", "12", "final"]) {
      for (const c of getCases(id)) for (const text of yamlBlocks(c.reference)) if (/^openapi:/m.test(text)) sources.push({ where: c.id, text });
    }
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const s of sources) {
      const r = checkOpenApi(s.text);
      expect(r.syntaxErrors, s.where).toEqual([]);
      expect(r.remarks.map((x) => `${x.rule}: ${x.message} (${x.where})`), s.where).toEqual([]);
    }
  });
});

describe("проверка OpenAPI: каждое правило срабатывает на своей ошибке", () => {
  const cases: [OpenApiRule, string, (s: string) => string][] = [
    ["version", "версия 3.0", (s) => s.replace("3.1.1", "3.0.3")],
    ["version", "нет поля openapi", (s) => s.replace("openapi: 3.1.1\n", "")],
    ["no-info", "нет версии API", (s) => s.replace("  version: 1.0.0\n", "")],
    ["no-info", "нет info", (s) => s.replace("info:\n  title: Тест\n  version: 1.0.0\n", "")],
    ["no-content", "нет paths, components и webhooks", () => "openapi: 3.1.1\ninfo:\n  title: Тест\n  version: 1\n"],
    ["path-slash", "адрес без слэша", (s) => s.replace("/items:", "items:")],
    ["no-operation-id", "нет operationId", (s) => s.replace("      operationId: listItems\n", "")],
    ["duplicate-operation-id", "повтор operationId", (s) => s + "    post:\n      operationId: listItems\n      responses:\n        '201':\n          description: Создано\n        '400':\n          description: Ошибка\n"],
    ["no-responses", "нет responses", () => "openapi: 3.1.1\ninfo:\n  title: Т\n  version: 1\npaths:\n  /a:\n    get:\n      operationId: a\n"],
    ["no-success-response", "нет ответа 2xx", (s) => s.replace("'200':", "'301':")],
    ["no-error-response", "операция с параметром без ответа 4xx", (s) => s.replace("/items:", "/items/{id}:").replace("      operationId: listItems\n", "      operationId: listItems\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n").replace("        '404':\n          description: Не найдено\n", "")],
    ["response-description", "ответ без описания", (s) => s.replace("          description: Список\n", "          x-note: пусто\n")],
    ["path-param-undeclared", "параметр пути не объявлен", (s) => s.replace("/items:", "/items/{id}:")],
    ["path-param-unused", "объявлен лишний параметр", (s) => s.replace("      operationId: listItems\n", "      operationId: listItems\n      parameters:\n        - name: lost\n          in: path\n          required: true\n          schema:\n            type: string\n")],
    ["path-param-required", "параметр пути не обязателен", (s) => s.replace("/items:", "/items/{id}:").replace("      operationId: listItems\n", "      operationId: listItems\n      parameters:\n        - name: id\n          in: path\n          schema:\n            type: string\n")],
    ["broken-ref", "ссылка в никуда", (s) => s.replace("description: Список", "$ref: '#/components/responses/Nope'")],
    ["required-not-in-properties", "обязательное поле не описано", (s) => s + "components:\n  schemas:\n    A:\n      type: object\n      required: [id, name]\n      properties:\n        id:\n          type: string\n"],
  ];
  for (const [rule, name, mutate] of cases) {
    it(`${rule}: ${name}`, () => {
      expect(rules(mutate(MIN))).toContain(rule);
    });
  }

  it("операция без параметров и тела может не иметь ответа об ошибке", () => {
    expect(rules(MIN.replace("        '404':\n          description: Не найдено\n", ""))).toEqual([]);
  });

  it("замечание указывает, где найдено, и на что опирается правило", () => {
    const r = checkOpenApi(MIN.replace("      operationId: listItems\n", "")).remarks[0];
    expect(r.where).toBe("paths./items.get");
    expect(r.source).toContain("правило курса");
    const v = checkOpenApi(MIN.replace("3.1.1", "3.0.3")).remarks[0];
    expect(v.source).toContain("OpenAPI 3.1.1");
  });

  it("параметр пути, объявленный на уровне пути через $ref на components, считается объявленным", () => {
    const src = `openapi: 3.1.1
info:
  title: Т
  version: 1
paths:
  /items/{id}:
    parameters:
      - $ref: '#/components/parameters/Id'
    get:
      operationId: getItem
      responses:
        '200':
          description: Ок
        '404':
          description: Нет
components:
  parameters:
    Id:
      name: id
      in: path
      required: true
      schema:
        type: string
`;
    expect(checkOpenApi(src).remarks).toEqual([]);
  });
});

describe("проверка OpenAPI: ошибки YAML и неверная форма", () => {
  it("синтаксическая ошибка YAML: правила не проверяются, указана строка", () => {
    const r = checkOpenApi("openapi: 3.1.1\ninfo:\n  title: [Тест\n  version: 1\n");
    expect(r.syntaxErrors.length).toBeGreaterThan(0);
    expect(r.syntaxErrors[0].line).toBeGreaterThan(0);
    expect(r.remarks).toEqual([]);
  });

  it("документ не объект: замечание not-mapping", () => {
    expect(rules("- a\n- b\n")).toEqual(["not-mapping"]);
    expect(rules("просто текст")).toEqual(["not-mapping"]);
  });

  it("пример с ошибками даёт все ожидаемые замечания", () => {
    const got = new Set(rules(BAD_SAMPLE));
    for (const r of ["version", "no-info", "path-slash", "no-operation-id", "path-param-undeclared", "response-description", "no-error-response", "broken-ref", "duplicate-operation-id", "required-not-in-properties"] as OpenApiRule[]) {
      expect(got.has(r), r).toBe(true);
    }
  });
});
