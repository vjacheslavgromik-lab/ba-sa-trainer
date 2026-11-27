import { describe, it, expect } from "vitest";
import { getTheoryParts } from "../../src/content/loader";

const [theory] = getTheoryParts("2");
const body = theory.body;
const section = (from: string, to: string) => body.slice(body.indexOf(from), body.indexOf(to));

describe("Теория модуля 2: правки по рецензии", () => {
  it("раздел 1: определение требования по IEEE из трёх частей со ссылкой на страницу Вигерса", () => {
    const def = section("**Определение.**", "Главное правило");
    expect(def).toMatch(/^1\. условия или возможности/m);
    expect(def).toMatch(/^2\. условия или возможности/m);
    expect(def).toMatch(/^3\. документированное представление/m);
    expect(def).toContain("Вигерс, с. 6");
    expect(def).toContain("Institute of Electrical and Electronics Engineers");
  });

  it("раздел 4.1: список техник выявления из BABOK, в том числе основные", () => {
    const part = section("Список техник выявления по BABOK", "### 4.2. Документирование");
    for (const t of ["Interviews", "Workshops", "Brainstorming", "Focus Groups", "Survey or Questionnaire", "Observation", "Document Analysis", "Interface Analysis", "Prototyping", "Process Analysis"]) {
      expect(part, t).toContain(`| ${t}`);
    }
    expect(part).toContain("п. 4.2.6");
    expect([...part.matchAll(/^\| [A-Z]/gm)].length).toBeGreaterThanOrEqual(15);
  });

  it("раздел 4.2: примеры спецификаций SRS, BRD, FRD и TSD, предупреждение о названиях и честная оговорка про TSD", () => {
    const part = section("**Примеры спецификаций", "### 4.3. Приоритеты");
    for (const t of ["SRS", "BRD", "FRD", "TSD"]) expect(part, t).toContain(`| ${t}`);
    expect(part).toContain("по-разному");
    expect(part).toContain("не утверждаем");
    expect(part).toContain("ГОСТ 34.602-89");
  });

  it("раздел 4.3: техники приоритизации, включая MoSCoW с оговоркой Вигерса и подходы BABOK", () => {
    const part = section("**Техники приоритизации.**", "### 4.4. Утверждение");
    for (const t of ["In or out", "Парное сравнение", "Трёхуровневая шкала", "MoSCoW", "$100", "Ценность, стоимость и риск"]) expect(part, t).toContain(`| ${t}`);
    for (const w of ["Must", "Should", "Could", "Won't"]) expect(part, w).toContain(w);
    expect(part).toContain("Вигерс не рекомендует");
    for (const w of ["группировка", "упорядочение", "согласование"]) expect(part.toLowerCase(), w).toContain(w);
    expect(part).toContain("п. 10.33");
  });

  it("глоссарий содержит новые сокращения", () => {
    const glossary = body.slice(body.indexOf("## Глоссарий"));
    for (const t of ["SRS", "BRD", "FRD", "TSD", "MoSCoW"]) expect(glossary, t).toContain(`**${t}`);
  });

  it("в тексте нет склеенных в одну строку таблиц", () => {
    expect(body).not.toMatch(/\|[ \t]+\|---/);
  });
});
