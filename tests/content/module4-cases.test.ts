import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("4");

describe("Кейсы модуля 4", () => {
  it("четыре кейса: ER с автопроверкой и три ручных", () => {
    expect(cases.map((c) => c.id)).toEqual(["M4-CASE-01", "M4-CASE-02", "M4-CASE-03", "M4-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["er", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "4", "cases");
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
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
      expect(q.theoryRef, id).toMatch(/глава \d+/);
    }
  });

  it("вопросы охватывают все девять глав теории", () => {
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

  it("правила ER-кейса ссылаются на существующие сущности и покрывают пять сущностей", () => {
    const rules = cases[0].er!.rules;
    expect(rules.entities.map((e) => e.id)).toEqual(["customer", "rental", "item", "equipment", "type"]);
    const ids = new Set(rules.entities.map((e) => e.id));
    for (const r of rules.relations ?? []) {
      expect(ids.has(r.from) && ids.has(r.to)).toBe(true);
    }
    expect(rules.relations).toHaveLength(4);
  });

  it("условие кейса про прокат не повторяет пример из главы 4: другая предметная область", () => {
    const text = cases[0].condition;
    expect(text).toContain("прокат");
    expect(text).not.toContain("заказ");
  });
});

describe("Кейс нормализации: данные и эталон согласованы", () => {
  const c2 = cases[1];
  const header = /^\| (номер_отправки[^\n]*) \|$/m.exec(c2.condition)![1].split(" | ");
  const relations = [...c2.reference.matchAll(/([\p{L}_]+)\(([^)]*)\)/gu)].map((m) => ({ name: m[1], attrs: m[2].split(",").map((a) => a.trim()) }));

  it("в таблице восемь атрибутов, в условии три строки данных", () => {
    expect(header).toHaveLength(8);
    expect([...c2.condition.matchAll(/^\| \d{3} \|/gm)]).toHaveLength(3);
  });

  it("эталон: четыре отношения, ни один атрибут не потерян и не добавлен", () => {
    expect(relations.map((r) => r.name)).toEqual(["Позиция_отправки", "Товар", "Отправка", "Пункт_выдачи"]);
    expect(new Set(relations.flatMap((r) => r.attrs))).toEqual(new Set(header));
  });

  it("эталон: транзитивная зависимость и частичная устранены", () => {
    const attrs = (n: string) => relations.find((r) => r.name === n)!.attrs;
    expect(attrs("Отправка")).not.toContain("адрес_пункта");
    expect(attrs("Позиция_отправки")).not.toContain("название_товара");
    expect(attrs("Товар")).toEqual(["артикул", "название_товара", "вес_кг"]);
  });

  it("данные в условии соответствуют зависимостям: у артикула T-2 всегда один вес и одно название", () => {
    const rows = [...c2.condition.matchAll(/^\| (\d{3}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([A-Z]-\d+) \| ([^|]+) \| ([\d.]+) \| (\d+) \|$/gm)];
    const t2 = rows.filter((r) => r[5] === "T-2");
    expect(t2.length).toBeGreaterThanOrEqual(2);
    expect(new Set(t2.map((r) => `${r[6]}|${r[7]}`)).size).toBe(1);
    const p1 = rows.filter((r) => r[3].trim() === "P-1");
    expect(new Set(p1.map((r) => r[4])).size).toBe(1);
  });
});
