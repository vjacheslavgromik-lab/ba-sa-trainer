import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("5");
const blocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("Кейсы модуля 5", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M5-CASE-01", "M5-CASE-02", "M5-CASE-03", "M5-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "5", "cases");
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

  it("вопросы охватывают все пять глав теории, кроме словаря", () => {
    const refs = cases.flatMap((c) => c.questions).map((id) => getQuestion(id)!.theoryRef);
    for (let chapter = 1; chapter <= 5; chapter++) {
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

describe("Эталоны кейсов модуля 5", () => {
  it("кейс 1 (BPMN): два пула, дорожки, шлюзы, таймер; потоки сообщений не соединяют дорожки одного пула", () => {
    const text = blocks(cases[0].reference)[0];
    expect((text.match(/^Пул «/gm) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(text).toContain("<X:");
    expect(text).toContain("<+>");
    expect(text).toContain("таймер");
    const pools = [...text.matchAll(/^Пул «([^»]+)»(?:, дорожка «([^»]+)»)?/gm)].map((m) => ({ pool: m[1], lane: m[2] }));
    const laneOfPool = new Map(pools.filter((p) => p.lane).map((p) => [p.lane!, p.pool]));
    for (const m of text.matchAll(/^Поток сообщений: «[^»]+» от (?:дорожки )?«([^»]+)» к «([^»]+)»/gm)) {
      const from = laneOfPool.get(m[1]) ?? m[1];
      const to = laneOfPool.get(m[2]) ?? m[2];
      expect(from, m[0]).not.toBe(to);
    }
  });

  it("кейс 2 (деятельность): есть ветвления, возврат цикла и три параллельные ветви", () => {
    const text = blocks(cases[1].reference)[0];
    expect((text.match(/<\?:/g) ?? []).length).toBe(2);
    expect((text.match(/\|\| \[/g) ?? []).length).toBe(3);
    expect(text).toMatch(/\[нет\] -> \[Показать ближайшие свободные окна\] -> \[Выбрать врача и время\]/);
  });

  it("кейс 3 (состояния): одно начальное, все состояния достижимы, из конечных нет выходов, условие 30 дней", () => {
    const text = blocks(cases[2].reference)[0];
    const trans = [...text.matchAll(/^(\[\*\]|[\p{L} ]+?) --(?:.+?--)?> (\[\*\]|[\p{L} ]+?)\s*$/gmu)].map((m) => [m[1], m[2]] as const);
    expect(trans.filter(([a]) => a === "[*]")).toHaveLength(1);
    const states = new Set(trans.flat().filter((s) => s !== "[*]"));
    expect(states.size).toBe(7);
    const reach = new Set<string>();
    const stack = trans.filter(([a]) => a === "[*]").map(([, b]) => b);
    while (stack.length) {
      const s = stack.pop()!;
      if (reach.has(s) || s === "[*]") continue;
      reach.add(s);
      for (const [a, b] of trans) if (a === s) stack.push(b);
    }
    expect(reach).toEqual(states);
    const finals = trans.filter(([, b]) => b === "[*]").map(([a]) => a);
    expect(finals.sort()).toEqual(["Аннулировано", "Выдано"]);
    for (const f of finals) expect(trans.filter(([a, b]) => a === f && b !== "[*]")).toHaveLength(0);
    expect(text).toContain("[прошло больше 30 дней]");
  });

  it("кейс 4 (DFD): контекст и уровень 0 сбалансированы, процессов 3–7, у каждого есть вход и выход", () => {
    const [context, level0] = blocks(cases[3].reference);
    const flows = (t: string) => [...t.matchAll(/^(.+?) --(.+?)--> (.+)$/gm)].map((m) => ({ from: m[1].trim(), name: m[2], to: m[3].trim() }));
    const c = flows(context);
    const l = flows(level0);
    const isProc = (s: string) => /^\d/.test(s);
    const isStore = (s: string) => /^D\d/.test(s);
    const external = (f: { from: string; to: string }) => [f.from, f.to].filter((s) => !isProc(s) && !isStore(s));
    expect(new Set(c.flatMap(external))).toEqual(new Set(l.flatMap(external)));
    expect(new Set(c.filter((f) => external(f).length).map((f) => f.name))).toEqual(new Set(l.filter((f) => external(f).length).map((f) => f.name)));
    const procs = new Set(l.flatMap((f) => [f.from, f.to]).filter(isProc));
    expect(procs.size).toBeGreaterThanOrEqual(3);
    expect(procs.size).toBeLessThanOrEqual(7);
    for (const p of procs) {
      expect(l.some((f) => f.to === p), `вход ${p}`).toBe(true);
      expect(l.some((f) => f.from === p), `выход ${p}`).toBe(true);
    }
    for (const p of procs) expect(p, p).toMatch(/^\d+ (Принять|Сформировать|Проверить|Выдать) /);
    const stores = new Set(l.flatMap((f) => [f.from, f.to]).filter(isStore));
    expect(stores.size).toBe(2);
  });
});
