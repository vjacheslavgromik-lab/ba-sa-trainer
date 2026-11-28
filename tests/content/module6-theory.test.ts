import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../helpers/theory";

const parts = getTheoryParts("6");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/6/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");
const blocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("Теория модуля 6: порядок и состав", () => {
  it("восемь глав по порядку: от интерфейса до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Пользовательский интерфейс и роль аналитика",
      "Персоны (Personas)",
      "Сценарии использования и карта пути пользователя",
      "Диаграмма структуры интерфейса (карта диалогов) и карта сайта",
      "Требования к элементам интерфейса и дизайн-система",
      "Прототипы: lo-fi и hi-fi, wireframe и storyboard",
      "Технологии интерфейсов: HTML, CSS, JavaScript",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты", () => {
    const all = parts.map((p) => p.body).join("\n").toLowerCase();
    for (const phrase of ["ввод", "вывод", "навигаци", "персона", "сценари", "карта пути", "карта диалогов", "карта сайта", "дизайн-система", "прототип", "lo-fi", "hi-fi", "wireframe", "storyboard", "html", "css", "javascript", "figma"]) {
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

  it("источники: Вигерс со страницами, открытые источники с адресами, оговорка про недоступную статью о сценариях", () => {
    expect(sources[0]).toMatch(/с\. \d+/);
    for (const i of [1, 2, 3, 4, 5, 6]) expect(sources[i], `глава ${i + 1}`).toMatch(/https:\/\//);
    expect(sources[2]).toContain("404");
    expect(parts[3].body).toMatch(/с\. 22[2-5]/);
    expect(parts[5].body).toMatch(/с\. 25[4-9]|с\. 26[0-2]/);
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 6: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["NN/g", "Nielsen Norman Group"],
    ["HTML", "HyperText Markup Language"],
    ["CSS", "Cascading Style Sheets"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я-])${abbr.replace("/", "\\/")}(?![A-Za-zА-Яа-я])`);
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
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toContain(`| ${abbr} |`);
  });
});

describe("Теория модуля 6: примеры", () => {
  it("карта диалогов записи: все экраны достижимы из «Главной», у каждого экрана есть выход или он конечный", () => {
    const text = blocks(parts[3].body)[0];
    const edges = [...text.matchAll(/^(.+?) --(.+?)--> (.+)$/gm)].map((m) => [m[1].trim(), m[3].trim()] as const);
    const screens = new Set(edges.flat());
    const reach = new Set<string>(["Главная"]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [a, b] of edges) if (reach.has(a) && !reach.has(b)) { reach.add(b); changed = true; }
    }
    expect(reach).toEqual(screens);
    const sinks = [...screens].filter((s) => !edges.some(([a]) => a === s));
    expect(sinks).toEqual(["Подтверждение записи"]);
  });

  it("карта сайта «Виты» содержит разделы личного кабинета и запись на приём", () => {
    const site = blocks(parts[3].body)[1];
    for (const item of ["Запись на приём", "Личный кабинет", "Результаты анализов", "Мои записи"]) expect(site).toContain(item);
  });

  it("пример элемента «Телефон» описывает назначение, тип, данные, состояния и проверку", () => {
    const el = blocks(parts[4].body)[0];
    for (const key of ["Назначение:", "Тип:", "Данные:", "Поведение:", "Состояния:", "Сообщение об ошибке:", "Проверка:"]) expect(el).toContain(key);
  });
});
