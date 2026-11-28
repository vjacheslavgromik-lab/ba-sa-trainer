import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../helpers/theory";

const parts = getTheoryParts("5");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/5/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");
const blocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("Теория модуля 5: порядок и состав", () => {
  it("шесть глав по порядку: от видов моделей до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Виды и уровни моделей процессов",
      "Диаграмма бизнес-процессов BPMN",
      "Диаграмма деятельности UML",
      "Модель состояний и диаграмма состояний UML",
      "Диаграмма потоков данных (DFD) в нотации Гейна–Сарсон",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты", () => {
    const all = parts.map((p) => p.body).join("\n").toLowerCase();
    for (const phrase of ["бизнес-процесс", "as-is", "bpmn", "шлюз", "пул", "дорожк", "диаграмма деятельности", "диаграмма состояний", "потоков данных", "гейна", "контекстн"]) {
      expect(all, phrase).toContain(phrase);
    }
  });

  it("в каждой главе (кроме словаря) есть цель, проверочные вопросы и источник", () => {
    for (const p of parts.slice(0, -1)) {
      expect(p.body, p.title).toContain("**Цель главы.**");
      expect(p.body, p.title).toContain("## Проверьте себя");
    }
    for (const src of sources) expect(src).not.toBe("");
  });

  it("глава про BPMN ссылается на страницы спецификации OMG и адрес, главы по Вендрову — на номера пунктов", () => {
    expect(sources[1]).toMatch(/https:\/\/www\.omg\.org/);
    expect(parts[1].body).toMatch(/с\. 2[6-9]|с\. 3\d|с\. 4[01]/);
    for (const i of [0, 2, 3, 4]) expect(parts[i].body, parts[i].title).toMatch(/п\. [23]\.\d/);
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 5: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["BPMN", "Business Process Model and Notation"],
    ["UML", "Unified Modeling Language"],
    ["DFD", "Data Flow Diagram"],
    ["OMG", "Object Management Group"],
    ["WS-BPEL", "Web Services Business Process Execution Language"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])`);
      for (let i = 0; i < parts.length - 1; i++) {
        const text = prose(parts[i].body);
        const m = re.exec(text);
        if (!m) continue;
        expect(text.slice(Math.max(0, m.index - 150), m.index + 450), `глава ${i + 1}`).toContain(full);
        return;
      }
      throw new Error(`${abbr} не найден`);
    });
  }

  it("словарь содержит все сокращения", () => {
    const glossary = parts[parts.length - 1].body;
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toMatch(new RegExp(`\\| ${abbr} \\|`));
  });
});

describe("Теория модуля 5: примеры", () => {
  it("диаграмма состояний записи: начальное состояние одно, все состояния достижимы, из конечных нет выходов", () => {
    const text = blocks(parts[3].body)[0];
    const edges = [...text.matchAll(/^(\[\*\]|[\p{L} ]+?) --(?:(.+?))?--> (\[\*\]|[\p{L} ]+?)\s*$/gmu)].map((m) => [m[1], m[3]] as const);
    const loose = [...text.matchAll(/^([\p{L} ]+?) --> (\[\*\])\s*$/gmu)].map((m) => [m[1], m[2]] as const);
    const all = [...edges, ...loose];
    expect(all.filter(([a]) => a === "[*]")).toHaveLength(1);
    const states = new Set(all.flat().filter((s) => s !== "[*]"));
    const reach = new Set<string>();
    const queue = all.filter(([a]) => a === "[*]").map(([, b]) => b);
    while (queue.length) {
      const s = queue.pop()!;
      if (reach.has(s) || s === "[*]") continue;
      reach.add(s);
      for (const [a, b] of all) if (a === s) queue.push(b);
    }
    expect(reach).toEqual(states);
    const finals = all.filter(([, b]) => b === "[*]").map(([a]) => a);
    expect(finals.length).toBeGreaterThanOrEqual(2);
    for (const f of finals) expect(all.filter(([a, b]) => a === f && b !== "[*]")).toHaveLength(0);
  });

  it("DFD: внешние сущности и внешние потоки уровня 0 совпадают с контекстной диаграммой, процессов 3–7", () => {
    const [context, level0] = blocks(parts[4].body);
    const flows = (t: string) => [...t.matchAll(/^(.+?) --(.+?)--> (.+)$/gm)].map((m) => ({ from: m[1].trim(), name: m[2], to: m[3].trim() }));
    const c = flows(context.replace("Контекст:\n", ""));
    const l = flows(level0);
    const isProc = (s: string) => /^\d/.test(s);
    const isStore = (s: string) => /^D\d/.test(s);
    const external = (f: { from: string; to: string }) => [f.from, f.to].filter((s) => !isProc(s) && !isStore(s));
    expect(new Set(c.flatMap(external))).toEqual(new Set(l.flatMap(external)));
    const procs = new Set(l.flatMap((f) => [f.from, f.to]).filter(isProc));
    expect(procs.size).toBeGreaterThanOrEqual(3);
    expect(procs.size).toBeLessThanOrEqual(7);
    const ext = (fl: typeof c) => fl.filter((f) => external(f).length > 0).map((f) => f.name);
    expect(new Set(ext(c))).toEqual(new Set(ext(l)));
  });

  it("DFD: у каждого процесса уровня 0 есть вход и выход", () => {
    const level0 = blocks(parts[4].body)[1];
    const flows = [...level0.matchAll(/^(.+?) --(.+?)--> (.+)$/gm)].map((m) => ({ from: m[1].trim(), to: m[3].trim() }));
    const procs = new Set(flows.flatMap((f) => [f.from, f.to]).filter((s) => /^\d/.test(s)));
    for (const p of procs) {
      expect(flows.some((f) => f.to === p), `вход ${p}`).toBe(true);
      expect(flows.some((f) => f.from === p), `выход ${p}`).toBe(true);
    }
  });

  it("диаграмма деятельности содержит ветвление и параллельные ветви", () => {
    const text = blocks(parts[2].body)[0];
    expect(text).toContain("<?:");
    expect(text).toContain("||");
  });
});
