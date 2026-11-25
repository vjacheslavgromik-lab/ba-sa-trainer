import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkCollection, type CaseRules } from "../../src/features/postman/checkCollection";
import { statusesFromScript } from "../../src/features/postman/parseCollection";

const valid = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/postman/school-valid.json"), "utf8"));
const clone = () => structuredClone(valid);
const text = (c: unknown) => JSON.stringify(c);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requests = (c: any) => c.item.flatMap((f: any) => f.item);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const find = (c: any, name: string) => requests(c).find((r: any) => r.name === name);

const CASE: CaseRules = {
  requests: [
    { method: "GET", path: "/students/{id}", statuses: [200, 404] },
    { method: "POST", path: "/enrollments", statuses: [201, 400], bodyFields: ["student_id", "course_id"] },
    { method: "DELETE", path: "/enrollments/{id}", statuses: [204] },
  ],
};

function rules(c: unknown, caseRules?: CaseRules): string[] {
  const r = checkCollection(text(c), caseRules);
  if (!r.ok) throw new Error(r.error);
  return r.violations.map((v) => v.rule);
}

describe("Postman: формат файла (US-6.2)", () => {
  it("не JSON → «Файл не является коллекцией Postman»", () => {
    expect(checkCollection("{не json")).toEqual({ ok: false, error: "Файл не является коллекцией Postman" });
  });
  it("JSON не того вида", () => {
    for (const t of ["[]", "null", "{}", '{"info":{},"item":[]}', '{"info":{"schema":"x"},"item":[]}']) {
      expect(checkCollection(t)).toEqual({ ok: false, error: "Файл не является коллекцией Postman" });
    }
  });
  it("принимает схему на новом домене schema.postman.com", () => {
    const c = clone();
    c.info.schema = "https://schema.postman.com/json/collection/v2.1.0/collection.json";
    expect(checkCollection(text(c)).ok).toBe(true);
  });
  it("коллекция v2.0 отклоняется с подсказкой про v2.1", () => {
    const c = clone();
    c.info.schema = "https://schema.getpostman.com/json/collection/v2.0.0/collection.json";
    const r = checkCollection(text(c));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("v2.1");
  });
});

describe("Postman: общие правила (US-5.2, FR-13)", () => {
  it("эталонная коллекция: нарушений 0", () => {
    const r = checkCollection(text(valid));
    expect(r).toEqual({ ok: true, requestCount: 6, violations: [] });
    expect(rules(valid, CASE)).toEqual([]);
  });

  it("P1: у GET есть тело, у POST тела нет", () => {
    const a = clone();
    find(a, "Список студентов").request.body = { mode: "raw", raw: "{}" };
    expect(rules(a)).toContain("P1");
    const b = clone();
    delete find(b, "Записать студента на курс").request.body;
    expect(rules(b)).toContain("P1");
  });

  it("P2: заголовок Content-Type не указан, тело не JSON", () => {
    const a = clone();
    const post = find(a, "Записать студента на курс").request;
    post.header = [];
    post.body.options = {};
    expect(rules(a)).toEqual(["P2"]);
    const b = clone();
    find(b, "Записать студента на курс").request.body.raw = "{student_id: 1,";
    expect(rules(b)).toEqual(["P2"]);
  });

  it("P2: переменные Postman в теле не ломают разбор JSON", () => {
    const c = clone();
    find(c, "Записать студента на курс").request.body.raw = '{"student_id": {{studentId}}, "course_id": 1}';
    expect(rules(c)).toEqual([]);
  });

  it("P3: хост зашит в адрес, пробелы, пустой адрес", () => {
    const a = clone();
    find(a, "Список студентов").request.url.raw = "http://localhost:3000/students";
    expect(rules(a)).toEqual(["P3"]);
    const b = clone();
    find(b, "Список студентов").request.url.raw = "{{baseUrl}}/stu dents";
    expect(rules(b)).toContain("P3");
    const c = clone();
    find(c, "Список студентов").request.url = { raw: "" };
    expect(rules(c)).toContain("P3");
  });

  it("P4: нет проверки кода ответа", () => {
    const c = clone();
    delete find(c, "Список студентов").event;
    const r = checkCollection(text(c));
    expect(r.ok && r.violations.map((v) => v.rule)).toEqual(["P4"]);
    expect(r.ok && r.violations[0].location).toBe("Студенты / Список студентов");
  });

  it("P5: запрос без названия по смыслу", () => {
    const c = clone();
    find(c, "Список студентов").name = "New Request";
    expect(rules(c)).toEqual(["P5"]);
  });

  it("P6: глагол в пути, регистр, единственное число", () => {
    const verb = clone();
    find(verb, "Список студентов").request.url.raw = "{{baseUrl}}/getStudents";
    expect(rules(verb)).toEqual(["P6"]);
    const dash = clone();
    find(dash, "Список студентов").request.url.raw = "{{baseUrl}}/create-student";
    expect(rules(dash)).toEqual(["P6"]);
    const caseV = clone();
    find(caseV, "Список студентов").request.url.raw = "{{baseUrl}}/Students";
    expect(rules(caseV)).toEqual(["P6"]);
    const singular = clone();
    find(singular, "Студент по id").request.url.raw = "{{baseUrl}}/student/:id";
    expect(rules(singular)).toEqual(["P6"]);
    const postSingular = clone();
    find(postSingular, "Записать студента на курс").request.url.raw = "{{baseUrl}}/enrollment";
    expect(rules(postSingular)).toEqual(["P6"]);
  });

  it("P6: camelCase и дефисы допустимы (Google AIP-122 рекомендует camelCase), подчёркивание и заглавная — нет", () => {
    const camel = clone();
    find(camel, "Список студентов").request.url.raw = "{{baseUrl}}/courseEnrollments";
    expect(rules(camel)).toEqual([]);
    const hyphen = clone();
    find(hyphen, "Список студентов").request.url.raw = "{{baseUrl}}/course-enrollments";
    expect(rules(hyphen)).toEqual([]);
    const snake = clone();
    find(snake, "Список студентов").request.url.raw = "{{baseUrl}}/course_enrollments";
    expect(rules(snake)).toEqual(["P6"]);
  });

  it("P6: не срабатывает на settings, версию, api и неправильные множественные", () => {
    const c = clone();
    find(c, "Список студентов").request.url.raw = "{{baseUrl}}/api/v1/settings";
    expect(rules(c)).toEqual([]);
    const people = clone();
    find(people, "Студент по id").request.url.raw = "{{baseUrl}}/people/:id";
    expect(rules(people)).toEqual([]);
  });

  it("считает вложенные папки и нумерует нарушения подряд", () => {
    const c = clone();
    c.item = [{ name: "A", item: [{ name: "B", item: [find(clone(), "Список студентов")] }] }];
    delete c.item[0].item[0].item[0].event;
    const r = checkCollection(text(c));
    expect(r.ok && r.violations).toMatchObject([{ number: 1, rule: "P4", location: "A / B / Список студентов" }]);
  });
});

describe("Postman: правила кейса (US-5.2)", () => {
  it("нет запроса с кодом 404 для GET /students/{id}", () => {
    const c = clone();
    c.item[0].item = c.item[0].item.filter((r: { name: string }) => r.name !== "Студент не найден");
    const r = checkCollection(text(c), CASE);
    expect(r.ok && r.violations).toMatchObject([{ rule: "C2", message: "Для GET /students/{id} нет проверки кода 404." }]);
  });

  it("нет обязательного запроса", () => {
    const c = clone();
    c.item[1].item = c.item[1].item.filter((r: { name: string }) => r.name !== "Отменить запись");
    const r = checkCollection(text(c), CASE);
    expect(r.ok && r.violations).toMatchObject([{ rule: "C1", message: "Нет запроса DELETE /enrollments/{id}." }]);
  });

  it("в теле нет обязательного поля", () => {
    const c = clone();
    find(c, "Записать студента на курс").request.body.raw = '{"student_id": 1}';
    find(c, "Запись с неверными данными").request.body.raw = '{"student_id": "x"}';
    expect(rules(c, CASE)).toEqual(["C3"]);
  });

  it("коды проверяются по объединению запросов к одному адресу", () => {
    expect(rules(valid, CASE)).toEqual([]);
  });
});

describe("Postman: коды ответа в тестах", () => {
  it("распознаёт разные формы проверки", () => {
    expect(statusesFromScript("pm.response.to.have.status(404);")).toEqual([404]);
    expect(statusesFromScript("pm.expect(pm.response.code).to.eql(201);")).toEqual([201]);
    expect(statusesFromScript("pm.expect(pm.response.code).to.be.oneOf([200, 204]);")).toEqual([200, 204]);
    expect(statusesFromScript("pm.response.to.be.ok;")).toEqual([200]);
    expect(statusesFromScript("console.log(1)")).toEqual([]);
  });
});

describe("Postman: источники нарушений (FR-16)", () => {
  const sourcesOf = (c: unknown, caseRules?: CaseRules) => {
    const r = checkCollection(text(c), caseRules);
    if (!r.ok) throw new Error(r.error);
    return r.violations.map((v) => ({ rule: v.rule, sources: v.sources }));
  };

  it("у P4 есть ссылка на Postman, RFC 9110 и шаблоны интеграции со страницей", () => {
    const c = clone();
    delete find(c, "Список студентов").event;
    const [v] = sourcesOf(c);
    const joined = v.sources.map((s) => s.text).join(" | ");
    expect(joined).toContain("Postman test script examples");
    expect(joined).toContain("RFC 9110");
    expect(joined).toContain("«Запрос-ответ», с. 177");
    expect(v.sources.find((s) => s.text.includes("Postman test"))?.url).toBe(
      "https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-examples/",
    );
  });

  it("у P6 ссылки на AIP-121 и AIP-122", () => {
    const c = clone();
    find(c, "Список студентов").request.url.raw = "{{baseUrl}}/getStudents";
    const urls = sourcesOf(c)[0].sources.map((s) => s.url);
    expect(urls).toEqual(["https://google.aip.dev/121", "https://google.aip.dev/122"]);
  });

  it("у C2 раздел RFC зависит от кода: 404 → §15.5.5, 400 → §15.5.1, прочие → §15", () => {
    const c = clone();
    c.item[0].item = c.item[0].item.filter((r: { name: string }) => r.name !== "Студент не найден");
    const [v] = sourcesOf(c, { requests: [{ method: "GET", path: "/students/{id}", statuses: [404] }] });
    expect(v.sources[0].text).toContain("§15.5.5");
    expect(v.sources[0].url).toBe("https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5");
    const [w] = sourcesOf(c, { requests: [{ method: "GET", path: "/students/{id}", statuses: [418] }] });
    expect(w.sources[0].text).toContain("§15 ");
  });

  it("у P5, C1 и C3 источников нет: подходящего раздела не нашлось", () => {
    const c = clone();
    find(c, "Список студентов").name = "New Request";
    expect(sourcesOf(c)[0]).toEqual({ rule: "P5", sources: [] });
  });
});
