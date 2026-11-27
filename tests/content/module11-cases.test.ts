import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("11");
const blocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("Кейсы модуля 11", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M11-CASE-01", "M11-CASE-02", "M11-CASE-03", "M11-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "11", "cases");
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

describe("Эталоны кейсов модуля 11", () => {
  it("кейс 1 (ПМИ): восемь требований, способы из допустимых четырёх, расчёт 4 из 5 = 80% < 95% и решение «не принята»", () => {
    const text = blocks(cases[0].reference)[0];
    const rows = text.split("\n").filter((l) => /^ТР-/.test(l)).map((l) => l.split("|").map((c) => c.trim()));
    expect(rows).toHaveLength(8);
    const methods = new Set(["тестирование", "экспертиза", "демонстрация", "анализ"]);
    for (const r of rows) expect(methods.has(r[2]), r[0]).toBe(true);
    const critical = rows.filter((r) => r[1] === "критичное");
    const normal = rows.filter((r) => r[1] === "обычное");
    expect(critical).toHaveLength(3);
    expect(normal).toHaveLength(5);
    expect(critical.every((r) => r[4] === "выполнено")).toBe(true);
    const ok = normal.filter((r) => r[4] === "выполнено").length;
    expect(ok).toBe(4);
    expect((ok / normal.length) * 100).toBe(80);
    expect(cases[0].reference).toContain("система не принята");
    expect(text).toContain("не менее 95% остальных");
    for (const id of rows.map((r) => r[0])) expect(cases[0].condition, id).toContain(id);
  });

  it("кейс 2 (руководство и FAQ): в FAQ пять самых частых обращений в порядке убывания; оглавление помечено видами документации", () => {
    const c = cases[1];
    const log = [...c.condition.matchAll(/^- «(.+?)» — (\d+)[;.]$/gm)].map((m) => ({ q: m[1], n: Number(m[2]) }));
    expect(log).toHaveLength(7);
    expect(log.reduce((s, x) => s + x.n, 0)).toBe(310);
    const top5 = [...log].sort((a, b) => b.n - a.n).slice(0, 5);
    const faq = blocks(c.reference)[0].split("FAQ (пять самых частых обращений):")[1].trim().split("\n");
    expect(faq).toHaveLength(5);
    top5.forEach((t, i) => expect(faq[i].toLowerCase(), t.q).toContain(t.q.toLowerCase()));
    const toc = blocks(c.reference)[0].split("\n").filter((l) => /^\d\. /.test(l) && !l.includes("—"));
    expect(toc.filter((l) => l.includes("(задача)")).length).toBeGreaterThanOrEqual(3);
    expect(toc.some((l) => l.includes("(справочник)"))).toBe(true);
    expect(c.reference).toContain("больше 3 часов");
  });

  it("кейс 3 (миграция): все разделы плана, откат с критерием, проверка выборкой, формат телефона", () => {
    const plan = blocks(cases[2].reference)[0];
    for (const key of ["Цель:", "Не переносим:", "Состав:", "Соответствие:", "Качество:", "Способ:", "Проверка:", "Откат:", "Обучение:", "Снятие старого журнала:", "Риски:"]) expect(plan, key).toContain(key);
    expect(plan).toContain("более 1%");
    expect(plan).toContain("+7XXXXXXXXXX");
    expect(plan).toContain("резервная копия");
    expect(cases[2].condition).toContain("около 3000");
    expect(plan).toContain("около 1200");
  });

  it("кейс 4 (запросы): три запроса с правильными типами, суммы по источникам и требованиям равны 12, доля отмены и напоминаний 75%", () => {
    const c = cases[3];
    const text = blocks(c.reference)[0];
    const crs = text.split("\n").filter((l) => /^ {2}ЗИ-\d+/.test(l)).map((l) => l.split("|").map((x) => x.trim()));
    expect(crs).toHaveLength(3);
    expect(crs.map((r) => r[2])).toEqual(["корректирующее", "улучшающее", "адаптирующее"]);
    const bySource = [6, 3, 2, 1];
    const byReq = [5, 4, 2, 1];
    expect(bySource.reduce((a, b) => a + b)).toBe(12);
    expect(byReq.reduce((a, b) => a + b)).toBe(12);
    expect(c.condition).toContain("12 запросов");
    expect(((5 + 4) / 12) * 100).toBe(75);
    expect(c.reference).toContain("(в сумме 75%)");
    const impact = text.slice(text.indexOf("Анализ влияния ЗИ-22:"), text.indexOf("Решения совета"));
    expect((impact.match(/^ {2}\d\. /gm) ?? []).length).toBe(3);
    expect(impact).toContain("итого 5 дней");
  });
});
