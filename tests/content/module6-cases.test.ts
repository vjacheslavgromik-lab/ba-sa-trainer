import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("6");
const blocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("Кейсы модуля 6", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M6-CASE-01", "M6-CASE-02", "M6-CASE-03", "M6-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "6", "cases");
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

describe("Эталоны кейсов модуля 6", () => {
  it("кейс 1: три персоны с целями, опасениями и контекстом и измеримые требования с числами", () => {
    const text = blocks(cases[0].reference)[0];
    expect((text.match(/^Персона \d\./gm) ?? []).length).toBe(3);
    for (const key of ["Цели:", "Опасения:", "Контекст:", "Требование:"]) expect((text.match(new RegExp(key, "g")) ?? []).length, key).toBe(3);
    const reqs = [...text.matchAll(/Требование: (.+)/g)].map((m) => m[1]);
    for (const r of reqs) expect(r, r).toMatch(/\d/);
    expect(text).not.toMatch(/хобби: |любимый цвет:/i);
  });

  it("кейс 2: вариант использования с шагами и альтернативой, карта пути из четырёх фаз, две возможности с метриками", () => {
    const text = blocks(cases[1].reference)[0];
    expect((text.match(/^ {4}\d\. /gm) ?? []).length).toBe(6);
    expect(text).toContain("Альтернативный ход 4а");
    expect((text.match(/^ {2}Фаза \d\./gm) ?? []).length).toBe(4);
    for (const key of ["Действия:", "Мысли:", "Эмоции:"]) expect((text.match(new RegExp(key, "g")) ?? []).length, key).toBe(4);
    const opps = text.slice(text.indexOf("Возможности:"));
    expect((opps.match(/метрика:/g) ?? []).length).toBe(2);
    expect((opps.match(/владелец:/g) ?? []).length).toBe(2);
  });

  it("кейс 3: все экраны карты диалогов достижимы из «Мои записи», правило двух часов отражено условием, карта сайта содержит разделы", () => {
    const [site, dialog] = blocks(cases[2].reference);
    for (const item of ["Мои записи", "Результаты анализов", "Профиль", "Запись на приём"]) expect(site).toContain(item);
    const edges = [...dialog.matchAll(/^(.+?) --(.+?)--> (.+)$/gm)].map((m) => [m[1].trim(), m[3].trim(), m[2]] as const);
    const screens = new Set(edges.flatMap(([a, b]) => [a, b]));
    const reach = new Set<string>(["Мои записи"]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [a, b] of edges) if (reach.has(a) && !reach.has(b)) { reach.add(b); changed = true; }
    }
    expect(reach).toEqual(screens);
    for (const s of screens) expect(edges.some(([a]) => a === s), `выход из «${s}»`).toBe(true);
    const conditions = edges.map((e) => e[2]).join("\n");
    expect(conditions).toContain("[до приёма больше 2 часов]");
    expect(conditions).toContain("[до приёма меньше 2 часов]");
  });

  it("кейс 4: три элемента по шаблону, lo-fi и hi-fi, три слоя HTML, CSS, JavaScript", () => {
    const text = blocks(cases[3].reference)[0];
    const keys = ["Назначение:", "Тип:", "Данные:", "Поведение:", "Состояния:", "Сообщение:", "Проверка:"];
    for (const key of keys) expect((text.match(new RegExp(key, "g")) ?? []).length, key).toBe(3);
    const r = cases[3].reference;
    for (const word of ["lo-fi", "hi-fi", "HTML", "CSS", "JavaScript", "пятью пациентами"]) expect(r, word).toContain(word);
  });
});
