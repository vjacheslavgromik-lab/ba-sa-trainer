import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCases, getQuestion } from "../../src/content/loader";
import { validateCase } from "../../src/content/validate";

const cases = getCases("8");
const block = (md: string) => /```text\n([\s\S]*?)```/.exec(md)![1];

describe("Кейсы модуля 8", () => {
  it("четыре ручных кейса по порядку", () => {
    expect(cases.map((c) => c.id)).toEqual(["M8-CASE-01", "M8-CASE-02", "M8-CASE-03", "M8-CASE-04"]);
    expect(cases.map((c) => c.check.type)).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("кейсы проходят валидацию", () => {
    const dir = join(process.cwd(), "content", "modules", "8", "cases");
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

  it("вопросы охватывают все шесть глав теории, кроме словаря", () => {
    const refs = cases.flatMap((c) => c.questions).map((id) => getQuestion(id)!.theoryRef);
    for (let chapter = 1; chapter <= 6; chapter++) {
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

describe("Содержание кейсов модуля 8", () => {
  const edges = [...block(cases[1].reference).matchAll(/\[([^\]]+)\]\s*-->\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2]] as const);

  it("эталон кейса 2: зависимости не образуют цикла, а все части из условия присутствуют", () => {
    expect(edges).toHaveLength(6);
    const graph = new Map<string, string[]>();
    for (const [a, b] of edges) graph.set(a, [...(graph.get(a) ?? []), b]);
    const state = new Map<string, number>();
    const hasCycle = (n: string): boolean => {
      if (state.get(n) === 2) return false;
      if (state.get(n) === 1) return true;
      state.set(n, 1);
      const cyc = (graph.get(n) ?? []).some(hasCycle);
      state.set(n, 2);
      return cyc;
    };
    expect([...graph.keys()].some(hasCycle)).toBe(false);
    const nodes = new Set(edges.flat());
    for (const part of ["сайт записи", "сервер приложений", "служба уведомлений", "правила записи", "доступ к данным", "модуль оплаты"]) {
      expect([...nodes].some((n) => n.startsWith(part)), part).toBe(true);
    }
  });

  it("эталон кейса 2: изменение модуля оплаты затрагивает только сервер приложений и тех, кто от него зависит", () => {
    const dependents = (target: string, seen = new Set<string>()): Set<string> => {
      for (const [a, b] of edges) if (b === target && !seen.has(a)) { seen.add(a); dependents(a, seen); }
      return seen;
    };
    expect([...dependents("модуль оплаты.lib")].sort()).toEqual(["сайт записи.exe", "сервер приложений.exe"]);
  });

  it("эталон кейса 3: каждый исполняемый компонент из кейса 2 размещён на узле", () => {
    const exes = [...new Set(edges.flat().filter((n) => n.endsWith(".exe")))];
    expect(exes).toHaveLength(3);
    const deployment = block(cases[2].reference);
    for (const e of exes) expect(deployment, e).toContain(e);
  });

  it("эталон кейса 3: сервер базы данных соединён только с сервером приложений по внутренней сети", () => {
    const text = block(cases[2].reference);
    expect(text).toContain("внутренняя сеть -->  Сервер базы данных");
    expect(text).not.toMatch(/интернет -->\s+Сервер базы данных/);
  });

  it("кейс 4: четыре симптома и все три оси куба названы в эталоне", () => {
    const c = cases[3];
    expect([...c.condition.matchAll(/^- /gm)]).toHaveLength(4);
    for (const axis of ["ось X", "ось Y", "ось Z"]) expect(c.reference.toLowerCase()).toContain(axis.toLowerCase());
    expect(c.reference).toContain("95%");
  });

  it("кейс 1: в условии пять фактов, в эталоне выбрана трёхуровневая схема и монолит на старте", () => {
    const c = cases[0];
    expect([...c.condition.matchAll(/^- /gm)]).toHaveLength(5);
    expect(c.reference).toContain("Трёхуровневая схема");
    expect(c.reference).toContain("монолит");
  });
});
