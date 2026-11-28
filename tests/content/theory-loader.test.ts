import { describe, it, expect } from "vitest";
import { MODULES } from "../../src/data/modules";
import { hasTheory, loadTheoryParts } from "../../src/content/loader";
import { getTheoryParts } from "../helpers/theory";

describe("ленивая загрузка теории", () => {
  it("hasTheory знает модули с теорией без загрузки текста: есть у всех 14 модулей, нет у несуществующего", () => {
    for (const m of MODULES) expect(hasTheory(m.id), m.id).toBe(true);
    expect(hasTheory("нет-такого")).toBe(false);
    expect(hasTheory("")).toBe(false);
  });

  it("загруженные главы совпадают с главами из тестового помощника: заголовки, текст и порядок, для всех модулей", async () => {
    for (const m of MODULES) {
      const lazy = await loadTheoryParts(m.id);
      const eager = getTheoryParts(m.id);
      expect(lazy.length, m.id).toBeGreaterThan(0);
      expect(lazy, m.id).toEqual(eager);
      for (const p of lazy) expect(p.title, m.id).not.toBe("");
    }
  });

  it("для модуля без теории возвращается пустой список", async () => {
    expect(await loadTheoryParts("нет-такого")).toEqual([]);
  });
});
