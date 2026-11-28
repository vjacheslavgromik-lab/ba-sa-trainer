import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../helpers/theory";
import { MODULES } from "../../src/data/modules";

const parts = getTheoryParts("final");
const dir = join(process.cwd(), "content/modules/final/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");

describe("Выпускной проект: положение о проекте", () => {
  it("две главы по порядку, у каждой есть цель, проверочные вопросы, итоги и источник", () => {
    expect(parts.map((p) => p.title)).toEqual(["Постановка проекта: письмо заказчика", "Памятка по этапам и чек-лист ревьюера"]);
    for (const p of parts) {
      expect(p.body, p.title).toContain("**Цель главы.**");
      expect(p.body, p.title).toContain("## Проверьте себя");
      expect(p.body, p.title).toContain("## Итоги");
    }
    for (const src of sources) expect(src).not.toBe("");
  });

  it("письмо заказчика размыто намеренно: нет процентов и цифр, кроме срока в месяцах", () => {
    const letter = parts[0].body.split("\n").filter((l) => l.startsWith(">")).join("\n");
    expect(letter.length).toBeGreaterThan(400);
    expect(letter).not.toMatch(/%/);
    expect(letter.replace(/четыре месяца/g, "")).not.toMatch(/\d/);
    expect(letter).toContain("Выборгской");
    expect(letter).toContain("Купчино");
  });

  it("шесть этапов по порядку, номера модулей в таблицах существуют", () => {
    const ids = new Set(MODULES.map((m) => m.id));
    for (const part of [parts[0].body]) {
      const rows = part.split("\n").filter((l) => /^\| \d\. /.test(l));
      expect(rows).toHaveLength(6);
      rows.forEach((r, i) => expect(r.startsWith(`| ${i + 1}. `)).toBe(true));
      for (const r of rows) {
        const last = r.split("|").map((c) => c.trim()).filter(Boolean).pop()!;
        const nums = [...last.matchAll(/\d+/g)].map((m) => m[0]);
        expect(nums.length, r).toBeGreaterThan(0);
        for (const n of nums) expect(ids.has(n), `модуль ${n}`).toBe(true);
      }
    }
    const memo = parts[1].body.split("\n").filter((l) => /^\| \d\. /.test(l));
    expect(memo).toHaveLength(6);
  });

  it("чек-лист ревьюера: десять нумерованных вопросов с ключевыми темами", () => {
    const list = parts[1].body.slice(parts[1].body.indexOf("## Общий чек-лист"), parts[1].body.indexOf("## Форма сдачи"));
    const items = [...list.matchAll(/^(\d+)\. \*\*([^*]+)\*\*/gm)];
    expect(items.map((m) => Number(m[1]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const names = items.map((m) => m[2]);
    for (const w of ["Измеримо", "Проверяемо", "Единый язык", "Согласовано", "исключения", "допущения", "цель", "риски"]) {
      expect(names.some((n) => n.toLowerCase().includes(w.toLowerCase())), w).toBe(true);
    }
  });

  it("сказано, что теории и вопросов в проекте нет и что оценивает чек-лист (75%) и эталон", () => {
    expect(parts[0].body).toContain("нет вопросов по теории");
    expect(parts[0].body).toContain("не менее 75%");
    expect(sources[0]).toContain("Теории в этом проекте нет");
    expect(parts[0].body).toContain("3–4 недели");
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});
