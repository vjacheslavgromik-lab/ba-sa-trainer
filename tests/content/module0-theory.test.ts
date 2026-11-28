import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../helpers/theory";
import { MODULES } from "../../src/data/modules";

const parts = getTheoryParts("0");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/0/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");

describe("Теория модуля 0: порядок и состав", () => {
  it("девять глав по порядку: от роли аналитика до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Кто такой системный аналитик",
      "Путь проекта от потребности до сдачи",
      "Этап 1. Потребность и цели",
      "Этап 2. Требования и модели",
      "Этап 3. Проектирование",
      "Этап 4. Реализация и тестирование",
      "Этапы 5–6. Сдача и поддержка",
      "Результаты аналитика и карта курса",
      "Словарь терминов",
    ]);
  });

  it("в каждой главе (кроме словаря) есть цель, проверочные вопросы, итоги и источник", () => {
    for (const p of parts.slice(0, -1)) {
      expect(p.body, p.title).toContain("**Цель главы.**");
      expect(p.body, p.title).toContain("## Проверьте себя");
      expect(p.body, p.title).toContain("## Итоги");
    }
    for (const src of sources) expect(src).not.toBe("");
  });

  it("сквозной пример «Вита» и цель 30% встречаются в главах этапов", () => {
    for (const i of [0, 2, 3, 6]) expect(parts[i].body, `глава ${i + 1}`).toContain("30%");
    for (const i of [0, 1, 2, 3, 4, 5, 6]) expect(parts[i].body, `глава ${i + 1}`).toContain("Вит");
  });

  it("ссылки на источники: пункты Вендрова и страницы Вигерса", () => {
    expect(parts[1].body).toContain("п. 1.2.1");
    expect(sources[1]).toContain("Тексты ГОСТ не читались");
    expect(sources[1]).toContain("рабочая схема курса");
    expect(parts[0].body).toMatch(/с\. 6[23]/);
    expect(parts[2].body).toMatch(/с\. 82–83/);
    expect(parts[2].body).toMatch(/с\. 98–99/);
    expect(parts[3].body).toMatch(/с\. 7–9/);
    expect(parts[4].body).toContain("п. 1.2.1");
    expect(parts[6].body).toContain("п. 1.2.1");
    expect(sources[6]).toContain("Тексты ГОСТ не читались");
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 0: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["API", "Application Programming Interface"],
    ["ТЗ", "техническое задание"],
    ["SQL", "Structured Query Language"],
    ["BPMN", "Business Process Model and Notation"],
    ["UML", "Unified Modeling Language"],
    ["ЖЦ ПО", "жизненный цикл программного обеспечения"],
    ["ISO", "International Organization for Standardization"],
    ["IEC", "International Electrotechnical Commission"],
    ["ER", "Entity-Relationship"],
    ["CI/CD", "Continuous Integration"],
    ["ПМИ", "программа и методика испытаний"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr.replace("/", "\\/")}(?![A-Za-zА-Яа-я/])`);
      for (let i = 0; i < parts.length - 1; i++) {
        const text = prose(parts[i].body);
        const m = re.exec(text);
        if (!m) continue;
        expect(text.slice(Math.max(0, m.index - 150), m.index + 450).toLowerCase(), `глава ${i + 1}`).toContain(full.toLowerCase());
        return;
      }
      throw new Error(`${abbr} не найден`);
    });
  }

  it("словарь содержит все сокращения", () => {
    const glossary = parts[parts.length - 1].body;
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toContain(`| ${abbr} |`);
  });
});

describe("Теория модуля 0: согласованность этапов и карты курса", () => {
  const STAGES = ["Потребность", "Требования", "Проектирование", "Реализация", "Сдача", "Поддержка"];

  it("шесть этапов названы по порядку в таблице главы 2, в таблице результатов и на рисунке", () => {
    const rows = [...parts[1].body.matchAll(/^\| (\d)\. (\S+) \|/gm)].map((m) => [Number(m[1]), m[2]] as const);
    expect(rows.map((r) => r[0])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.map((r) => r[1])).toEqual(STAGES);
    const results = [...parts[7].body.matchAll(/^\| (\d)\. (\S+) \|/gm)].map((m) => m[2]);
    expect(results).toEqual(STAGES);
    const svg = readFileSync(join(process.cwd(), "public/theory-images/m0/project-path.svg"), "utf8");
    let pos = 0;
    for (const s of STAGES) {
      const next = svg.indexOf(`>${s}<`, pos);
      expect(next, s).toBeGreaterThan(pos);
      pos = next;
    }
  });

  it("рисунок: файл есть, SVG корректен, у картинки есть описание и подпись", () => {
    const m = /!\[([^\]]+)\]\(\.\/theory-images\/m0\/project-path\.svg\)\n\n\*(Рис\. 1\.[^*]+)\*/.exec(parts[1].body);
    expect(m, "рисунок в главе 2").not.toBeNull();
    expect(m![1].length).toBeGreaterThan(15);
    const svg = readFileSync(join(process.cwd(), "public/theory-images/m0/project-path.svg"), "utf8");
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toMatch(/<title id="t">[^<]+<\/title>/);
    expect(svg).toMatch(/<desc id="d">[^<]+<\/desc>/);
    const [w] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!.slice(1).map(Number);
    for (const r of svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)) expect(Number(r[1]) + Number(r[2]), "блок выходит за холст").toBeLessThanOrEqual(w);
    expect(existsSync(join(process.cwd(), "public/theory-images/m0/project-path.svg"))).toBe(true);
  });

  it("карта курса: номера модулей в главах существуют и по каждому этапу указан хотя бы один", () => {
    const ids = new Set(MODULES.map((m) => m.id));
    const table = parts[7].body.slice(parts[7].body.indexOf("| Этап | Основные результаты"), parts[7].body.indexOf("Профессию и среду"));
    const rows = table.split("\n").filter((l) => /^\| \d\. /.test(l));
    expect(rows).toHaveLength(6);
    const covered = new Set<string>();
    for (const r of rows) {
      const last = r.split("|").map((c) => c.trim()).filter(Boolean).pop()!;
      const nums = [...last.matchAll(/\d+/g)].map((m) => m[0]);
      expect(nums.length, r).toBeGreaterThan(0);
      for (const n of nums) {
        expect(ids.has(n), `модуль ${n}`).toBe(true);
        covered.add(n);
      }
    }
    // модули 2–12 все названы в карте (модули 0 и 1 описаны текстом)
    for (let n = 2; n <= 12; n++) expect(covered.has(String(n)), `модуль ${n}`).toBe(true);
  });

  it("таблица «что просят в вакансиях» ведёт на существующие модули и сказано, чего в курсе нет", () => {
    const ids = new Set(MODULES.map((m) => m.id));
    const body = parts[7].body;
    const part = body.slice(body.indexOf("| Что просят в вакансиях"), body.indexOf("Не разбираются в курсе"));
    const nums = [...part.matchAll(/\| ([\d, ]+) \|$/gm)].flatMap((m) => m[1].split(",").map((x) => x.trim()));
    expect(nums.length).toBeGreaterThan(10);
    for (const n of nums) expect(ids.has(n), `модуль ${n}`).toBe(true);
    expect(body).toContain("Jira, Confluence и Docker");
  });

  it("пример «Виты» согласован с модулями 10 и 11: правило отмены за 2 часа, критерий приёмки 95%", () => {
    expect(parts[3].body).toContain("не позднее чем за 2 часа");
    expect(parts[5].body).toContain("не позднее чем за 2 часа");
    expect(parts[5].body).toContain("ровно за 2 часа");
    expect(parts[6].body).toContain("не менее 95% остальных");
    expect(parts[4].body).toContain("**201**");
    expect(parts[4].body).toContain("**409**");
  });
});
