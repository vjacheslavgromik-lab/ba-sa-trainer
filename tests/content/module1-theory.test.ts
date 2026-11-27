import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../../src/content/loader";

const parts = getTheoryParts("1");
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\*/g, "");
const dir = join(process.cwd(), "content/modules/1/theory");
const sources = readdirSync(dir).sort().map((f) => /^source: "(.*)"$/m.exec(readFileSync(join(dir, f), "utf8"))?.[1] ?? "");

describe("Теория модуля 1: порядок и состав", () => {
  it("девять глав по порядку: от команды до словаря", () => {
    expect(parts.map((p) => p.title)).toEqual([
      "Команда разработки ПО и её участники",
      "Бизнес-аналитик и системный аналитик: общее и различия",
      "Технические требования и вклад системного аналитика",
      "Жизненный цикл ПО и стандарт ISO/IEC 12207",
      "Модели жизненного цикла: каскадная, спиральная, итерационная",
      "Гибкая разработка: Agile и Scrum",
      "Типы ПО: веб, десктоп и мобильные приложения",
      "Клиент–сервер и микросервисы: взгляд аналитика",
      "Словарь терминов",
    ]);
  });

  it("темы программы курса покрыты, включая технические требования системного аналитика", () => {
    const all = parts.map((p) => p.body).join("\n").toLowerCase();
    for (const phrase of ["жизненный цикл", "каскадн", "спиральн", "scrum", "манифест", "веб-приложение", "мобильн", "микросервис", "системный аналитик", "бизнес-аналитик", "технические требования", "системные требования", "атрибуты качества", "внешним интерфейсам", "ограничения", "определения данных", "распределение"]) {
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

  it("главы по книгам ссылаются на страницы или пункты, главы по открытым источникам — на адрес", () => {
    for (const i of [0, 1, 2, 5]) expect(parts[i].body, parts[i].title).toMatch(/с\. \d+/);
    for (const i of [3, 4]) expect(parts[i].body, parts[i].title).toMatch(/п\. 1\.\d/);
    expect(sources[1]).toMatch(/wikipedia\.org/);
    expect(sources[5]).toMatch(/agilemanifesto\.org/);
    expect(sources[6]).toMatch(/developer\.mozilla\.org/);
  });

  it("в главе про роли сказано, что граница ролей — практика, а не норма", () => {
    expect(sources[1]).toMatch(/не как норма|не норма|а не как норма/);
    expect(parts[1].body).toContain("практику рынка");
    expect(sources[1]).toContain("замечании рецензента");
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    for (const p of parts) expect(p.body).not.toMatch(/\|[ \t]+\|---/);
  });
});

describe("Теория модуля 1: расшифровки и словарь", () => {
  const EXPANSIONS: [string, string][] = [
    ["ISO", "International Organization for Standardization"],
    ["XP", "Extreme Programming"],
    ["API", "Application Programming Interface"],
    ["SRS", "software requirements specification"],
    ["RUP", "Rational Unified Process"],
    ["MSF", "Microsoft Solutions Framework"],
    ["PWA", "Progressive Web App"],
  ];
  for (const [abbr, full] of EXPANSIONS) {
    it(`${abbr}: рядом с первым упоминанием стоит расшифровка`, () => {
      const re = new RegExp(`(?<![A-Za-zА-Яа-я/-])${abbr}(?![A-Za-zА-Яа-я])`);
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
    for (const [abbr] of EXPANSIONS) expect(glossary, abbr).toMatch(new RegExp(`\\| ${abbr} \\|`));
  });
});

describe("Теория модуля 1: числа и перечни", () => {
  const lifecycle = parts[3].body;

  it("стандарт 12207: 5 основных, 8 вспомогательных и 4 организационных процесса — всего 17", () => {
    expect(lifecycle).toContain("17 процессов");
    for (const [kind, count] of [["пять основных", 5], ["восемь вспомогательных", 8], ["четыре организационных", 4]] as const) {
      const line = new RegExp(`\\*\\*${kind}:\\*\\* ([^\\n]+)`).exec(lifecycle)![1];
      expect(line.split(",").length, kind).toBe(count);
    }
  });

  it("процесс разработки: 13 пронумерованных действий, два из них про анализ требований", () => {
    const section = lifecycle.slice(lifecycle.indexOf("Процесс разработки включает 13 действий"), lifecycle.indexOf("Подготовительная работа начинается"));
    const items = [...section.matchAll(/^(\d+)\. (.+?)[;.]$/gm)];
    expect(items).toHaveLength(13);
    expect(items.filter((m) => /анализ требований/.test(m[2]))).toHaveLength(2);
  });

  it("манифест Agile: четыре ценности и принципы приведены", () => {
    const agile = parts[5].body;
    for (const value of ["люди и взаимодействие", "работающее ПО", "сотрудничество с заказчиком", "готовность реагировать"]) expect(agile.toLowerCase()).toContain(value.toLowerCase());
    expect(agile).toContain("двенадцать принципов");
  });

  it("глава про технические требования называет и системного аналитика, и распределение по подсистемам", () => {
    const t = parts[2].body;
    expect(t).toContain("системный аналитик");
    expect(t).toContain("распределение");
    expect(t).toContain("99,5%");
  });
});

describe("Теория модуля 1: правки по рецензии", () => {
  it("глава 1: классическая команда Scrum на небольших проектах, на больших состав зависит от проекта, со ссылками на Вендрова и Вигерса", () => {
    const t = parts[0].body;
    expect(t).toContain("встречается сегодня в основном на небольших проектах");
    expect(t).toContain("### Размер команды зависит от проекта");
    expect(t).toContain("3–7 человек");
    expect(t).toContain("п. 1.3.2");
    expect(t).toContain("более 100 человек");
    expect(t).toContain("20 подпроектов");
    expect(t).toMatch(/гл\. 10, с\. 184/);
    expect(t).toMatch(/гл\. 19, с\. 367/);
    expect(t).toContain("определяются спецификой и сложностью проекта");
    expect(sources[0]).toContain("п. 1.3.2");
  });

  it("глава 2: в заказной разработке технические требования писал и бизнес-аналитик; у системного аналитика интеграции, API и низкий уровень взаимодействия", () => {
    const t = parts[1].body;
    expect(t).toContain("выполнял и бизнес-аналитик");
    for (const phrase of ["описание интеграций", "создание спецификаций API", "брокеры сообщений"]) expect(t.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    expect(t).not.toContain("превращает бизнес-требования в технические");
    const rows = t.split("\n").filter((l) => /^\| (Спецификация API|События и обмен|Описание интеграции)/.test(l));
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r).toMatch(/\| да \|$/);
  });

  it("глава 3: функциональные и нефункциональные требования не закреплены за системным аналитиком, добавлен раздел о его области", () => {
    const t = parts[2].body;
    expect(t).toContain("## Что остаётся именно системному аналитику");
    expect(t).toContain("в заказной разработке функциональные и нефункциональные требования часто писал и бизнес-аналитик");
    expect(t).not.toContain("Системный аналитик переводит «хочу»");
    for (const phrase of ["Описание интеграций", "Спецификации API", "Взаимодействие систем на низком уровне"]) expect(t, phrase).toContain(phrase);
  });
});

