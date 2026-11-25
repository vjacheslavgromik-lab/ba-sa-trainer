import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { getTheoryParts } from "../../src/content/loader";

const parts = getTheoryParts("9");

/** Текст без блоков кода и встроенного кода: в них сокращения не расшифровывают. */
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");

describe("Теория модуля 9: расшифровка терминов (рецензия)", () => {
  // Сокращение → фрагмент расшифровки, который должен стоять рядом с первым упоминанием.
  const EXPANSIONS: [string, string][] = [
    ["API", "Application Programming Interface"],
    ["HTTP", "Hypertext Transfer Protocol"],
    ["TCP", "Transmission Control Protocol"],
    ["URI", "Uniform Resource Identifier"],
    ["URL", "Uniform Resource Locator"],
    ["JSON", "JavaScript Object Notation"],
    ["TLS", "Transport Layer Security"],
    ["XML", "Extensible Markup Language"],
    ["SOAP", "Simple Object Access Protocol"],
    ["REST", "Representational State Transfer"],
    ["SQL", "Structured Query Language"],
    ["RPC", "Remote Procedure Call"],
    ["UML", "Unified Modeling Language"],
  ];

  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: при первом упоминании в тексте рядом стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])`);
      for (let i = 0; i < parts.length; i++) {
        const text = prose(parts[i].body);
        const m = re.exec(text);
        if (!m) continue;
        const near = text.slice(Math.max(0, m.index - 120), m.index + 260);
        expect(near, `глава ${i + 1}, первое упоминание ${abbr}`).toContain(full);
        return;
      }
      throw new Error(`${abbr} не найден в тексте`);
    });
  }

  it("в словаре есть все расшифрованные сокращения", () => {
    const glossary = parts[parts.length - 1].body;
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toMatch(new RegExp(`\\| ${abbr} \\|`));
    for (const abbr of ["HTTPS", "IP", "UTF-8", "YAML", "OAS"]) expect(glossary, abbr).toContain(`| ${abbr} |`);
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 9: артефакты документирования (рецензия)", () => {
  const chapter = parts.find((p) => p.title.startsWith("Документирование API"));

  it("есть глава про артефакты, в ней спецификация OpenAPI и остальные документы", () => {
    expect(chapter).toBeTruthy();
    const body = chapter?.body ?? "";
    for (const word of ["Таблица операций", "Описание данных", "Каталог ошибок", "Примеры запросов", "Спецификация OpenAPI", "Диаграмма последовательности", "Диаграмма компонентов", "Коллекция Postman"]) {
      expect(body, word).toContain(word);
    }
  });

  // Правила проверки взяты из спецификации OpenAPI 3.1.1 (проверены по документу).
  const yamlText = /```yaml\n([\s\S]*?)```/.exec(chapter?.body ?? "")?.[1] ?? "";
  const doc = parse(yamlText) as Record<string, any>;

  it("пример спецификации: обязательные поля корневого объекта и info", () => {
    expect(String(doc.openapi)).toMatch(/^3\.1\./);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
    expect(doc.paths || doc.components || doc.webhooks).toBeTruthy();
  });

  it("пример спецификации: пути, параметры пути, ответы и ссылки корректны", () => {
    const schemas = doc.components.schemas as Record<string, unknown>;
    const refs: string[] = [];
    const collect = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(collect);
      else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (k === "$ref") refs.push(String(v));
          else collect(v);
        }
      }
    };
    collect(doc);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(schemas, ref).toHaveProperty(ref.replace("#/components/schemas/", ""));

    for (const [path, item] of Object.entries<any>(doc.paths)) {
      expect(path.startsWith("/")).toBe(true);
      const templates = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      for (const op of Object.values<any>(item)) {
        const pathParams = (op.parameters ?? []).filter((p: any) => p.in === "path");
        for (const p of pathParams) {
          expect(p.required, `${path} ${p.name}`).toBe(true);
          expect(templates, `${path} ${p.name}`).toContain(p.name);
          expect(Boolean(p.schema) !== Boolean(p.content)).toBe(true);
        }
        for (const t of templates) expect(pathParams.map((p: any) => p.name)).toContain(t);
        const codes = Object.keys(op.responses);
        expect(codes.length).toBeGreaterThan(0);
        for (const code of codes) expect(op.responses[code].description, `${path} ${code}`).toBeTruthy();
      }
    }
  });

  it("пример спецификации согласован с таблицей операций из главы 7", () => {
    expect(Object.keys(doc.paths)).toEqual(["/students/{id}", "/enrollments"]);
    expect(Object.keys(doc.paths["/students/{id}"].get.responses)).toEqual(["200", "404"]);
    expect(Object.keys(doc.paths["/enrollments"].post.responses)).toEqual(["201", "400"]);
    expect(doc.components.schemas.EnrollmentRequest.required).toEqual(["student_id", "course_id"]);
  });
});
