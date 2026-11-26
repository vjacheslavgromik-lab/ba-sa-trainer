import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("1");
const block = (md: string) => /```text\n([\s\S]*?)```/.exec(md)![1];

describe("Кейсы модуля 1", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M1-CASE-01", "M1-CASE-02", "M1-CASE-03", "M1-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "1", "cases");
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

describe("Эталоны кейсов модуля 1", () => {
  it("кейс 1: десять задач, технические требования у системного аналитика, бизнес-часть у бизнес-аналитика, граница названа практикой", () => {
    const c = cases[0];
    expect([...c.condition.matchAll(/^- /gm)]).toHaveLength(10);
    const lines = block(c.reference).trim().split("\n");
    expect(lines).toHaveLength(10);
    const line = (n: number) => lines[n - 1];
    for (const n of [4, 5, 6]) expect(line(n), `задача ${n}`).toContain("системный аналитик");
    for (const n of [2, 3]) expect(line(n), `задача ${n}`).toContain("бизнес-аналитик");
    expect(line(7)).toContain("архитектор");
    expect(line(9)).toContain("разработчики");
    expect(c.reference).toContain("распространённая практика, а не норма");
  });

  it("кейс 2: все десять технических требований распределены по подсистемам, нефункциональные измеримы", () => {
    const text = block(cases[1].reference);
    const ids = ["Ф1", "Ф2", "Н1", "Н2", "И1", "И2", "Д1", "Д2", "О1", "О2"];
    const alloc = text.slice(text.indexOf("Распределение по подсистемам"));
    for (const id of ids) {
      expect(text, id).toContain(`${id}.`);
      expect(alloc, id).toContain(id);
    }
    const nfr = text.slice(text.indexOf("Нефункциональные"), text.indexOf("Внешние интерфейсы"));
    expect(nfr).toContain("2 секунды в 95%");
    expect(nfr).toContain("99,5%");
    expect(text).toContain("служба уведомлений: И2");
  });

  it("кейс 3: каскадная для части А, итерационная со Scrum для части Б, названы два действия анализа требований", () => {
    const r = cases[2].reference;
    expect(r).toMatch(/Часть А — каскадная/);
    expect(r).toMatch(/Часть Б — итерационный подход со Scrum/);
    expect(r).toContain("Анализ требований к системе");
    expect(r).toContain("Анализ требований к ПО");
    expect([...r.matchAll(/Спринт \d\. Цель/g)]).toHaveLength(2);
  });

  it("кейс 4: выбраны типы для трёх групп и упомянут регулятор", () => {
    const r = cases[3].reference;
    for (const group of ["Регистраторы", "Врачи", "Пациенты"]) expect(r).toContain(group);
    expect(r).toContain("PWA");
    expect(r).toContain("регулятор");
  });
});
