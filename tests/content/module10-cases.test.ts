import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("10");
const block = (md: string) => /```text\n([\s\S]*?)```/.exec(md)![1];

describe("Кейсы модуля 10", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M10-CASE-01", "M10-CASE-02", "M10-CASE-03", "M10-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "10", "cases");
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

  it("вопросы охватывают главы 1–7 теории", () => {
    const refs = cases.flatMap((c) => c.questions).map((id) => getQuestion(id)!.theoryRef);
    for (let chapter = 1; chapter <= 7; chapter++) {
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
});

describe("Эталоны кейсов модуля 10", () => {
  it("кейс 1: в плане все обязательные разделы, критерии и непроверяемое непусты", () => {
    const plan = block(cases[0].reference);
    for (const key of ["Идентификатор плана:", "Объекты:", "Проверяется:", "Не проверяется:", "Подход:", "Критерий успеха:", "Критерий приостановки:", "Среда:", "Ответственность:", "График:"]) {
      const m = new RegExp(`${key} (.+)`).exec(plan);
      expect(m, key).toBeTruthy();
      expect(m![1].length, key).toBeGreaterThan(5);
    }
    expect(plan).toContain("2 секунды в 95%");
  });

  it("кейс 2: шесть кейсов, два граничных, один непройденный — граница «ровно 2 часа» с расхождением", () => {
    const rows = block(cases[1].reference).trim().split("\n");
    expect(rows).toHaveLength(6);
    const parsed = rows.map((r) => r.split(" | ").map((x) => x.trim()));
    for (const p of parsed) expect(p.length, p[0]).toBe(7);
    expect(parsed.filter((p) => p[1] === "граничный")).toHaveLength(2);
    expect(parsed.filter((p) => p[1] === "позитивный").length).toBeGreaterThanOrEqual(1);
    expect(parsed.filter((p) => p[1] === "негативный").length).toBeGreaterThanOrEqual(2);
    const failed = parsed.filter((p) => p[6] === "не пройден");
    expect(failed).toHaveLength(1);
    expect(failed[0][0]).toBe("ТК-ОТМ-03");
    expect(failed[0][2]).toContain("ровно за 2 часа");
    expect(failed[0][4]).toContain("отменена");
    expect(failed[0][5]).toContain("телефон");
    for (const p of parsed.filter((q) => q[6] === "пройден")) {
      const exp = p[4].replace("ожидаемо: ", "");
      const act = p[5].replace("фактически: ", "");
      expect(act.length, p[0]).toBeGreaterThan(0);
      expect(exp.length, p[0]).toBeGreaterThan(0);
    }
    expect(cases[1].reference).toContain("Отчёт о расхождении");
  });

  it("кейс 3: матрица из четырёх требований, у одного нет теста, у одного тест не пройден; версия 1.2", () => {
    const rows = block(cases[2].reference).trim().split("\n").slice(1);
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.includes("нет теста"))).toHaveLength(1);
    expect(rows.filter((r) => r.includes("не пройден"))).toHaveLength(1);
    expect(rows.filter((r) => r.includes("нет теста"))[0]).toContain("ТР-ОТМ-4");
    expect(rows.filter((r) => r.includes("не пройден"))[0]).toContain("ТР-ОТМ-3");
    expect(cases[2].reference).toContain("версия 1.2");
  });

  it("кейс 4: семь шагов конвейера в правильном порядке, выпуск в продуктив решает владелец продукта", () => {
    const steps = block(cases[3].reference).trim().split("\n");
    expect(steps).toHaveLength(7);
    const idx = (s: string) => steps.findIndex((l) => l.includes(s));
    expect(idx("Запуск")).toBe(0);
    expect(idx("модульные и интеграционные")).toBeLessThan(idx("Версия-кандидат"));
    expect(idx("Версия-кандидат")).toBeLessThan(idx("Приёмочные сценарии"));
    expect(idx("Приёмочные сценарии")).toBeLessThan(idx("Тест производительности"));
    expect(idx("Тест производительности")).toBeLessThan(idx("среде приёмки"));
    expect(steps[6]).toContain("владелец продукта");
  });
});
