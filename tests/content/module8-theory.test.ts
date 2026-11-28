import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../helpers/theory";

const parts = getTheoryParts("8");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/8/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");

describe("Теория модуля 8: порядок и состав", () => {
  it("семь глав по порядку: от клиент–сервер до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Клиент–сервер: двухуровневая и трёхуровневая архитектура",
      "Многослойная архитектура",
      "Монолит и микросервисы",
      "Масштабирование и масштабный куб",
      "Диаграмма компонентов",
      "Диаграмма размещения",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты", () => {
    const all = parts.map((p) => p.body).join("\n").toLowerCase();
    for (const phrase of ["двухуровнев", "трёхуровнев", "слой", "микросервис", "монолит", "масштабный куб", "диаграмма компонентов", "диаграмма размещения", "узел"]) {
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

  it("глава по Коннолли ссылается на печатные страницы, главы по открытым источникам — на адрес, главы по Вендрову — на пункты книги", () => {
    expect(parts[0].body).toMatch(/с\. 10[4-7]/);
    expect(parts[0].body).toMatch(/с\. 112[1-4]/);
    for (const src of sources.slice(1, 4)) expect(src).toMatch(/https:\/\//);
    expect(parts[4].body).toContain("п. 2.5.6");
    expect(parts[5].body).toContain("п. 2.5.7");
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 8: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["СУБД", "Database Management System"],
    ["SQL", "Structured Query Language"],
    ["OLTP", "On-Line Transaction Processing"],
    ["HTTP", "HyperText Transfer Protocol"],
    ["API", "Application Programming Interface"],
    ["GDPR", "General Data Protection Regulation"],
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

describe("Теория модуля 8: примеры", () => {
  it("зависимости в примере компонентов не образуют цикла", () => {
    const block = /```text\n([\s\S]*?)```/.exec(parts[4].body)![1];
    const edges = [...block.matchAll(/\[([^\]]+)\]\s*-->\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2]] as const);
    expect(edges.length).toBe(5);
    const graph = new Map<string, string[]>();
    for (const [a, b] of edges) graph.set(a, [...(graph.get(a) ?? []), b]);
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (n: string): boolean => {
      if (done.has(n)) return false;
      if (visiting.has(n)) return true;
      visiting.add(n);
      const cyc = (graph.get(n) ?? []).some(visit);
      visiting.delete(n);
      done.add(n);
      return cyc;
    };
    expect([...graph.keys()].some(visit)).toBe(false);
  });

  it("в примере размещения у каждого исполняемого компонента из диаграммы компонентов есть узел", () => {
    const comps = /```text\n([\s\S]*?)```/.exec(parts[4].body)![1].match(/\[[^\]]*\.exe\]/g)!.map((s) => s.slice(1, -1));
    const deployment = /```text\n([\s\S]*?)```/.exec(parts[5].body)![1];
    expect(new Set(comps).size).toBe(3);
    for (const c of new Set(comps).values()) expect(deployment, c).toContain(c);
  });
});
