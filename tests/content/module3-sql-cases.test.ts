import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { runSqlCheck } from "../../src/features/sql/runSqlCheck";
import { DEMO_SETUP } from "../../src/features/sql/sandbox";
import { validateCase } from "../../src/content/validate";

const dir = join(process.cwd(), "content", "modules", "3", "cases");
const cases = readdirSync(dir).map((f) => ({ file: f, data: JSON.parse(readFileSync(join(dir, f), "utf8")) }));
let engine: SqlJsStatic;

beforeAll(async () => {
  engine = await initSqlJs({ wasmBinary: readFileSync(join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm")) as never });
});

describe("кейсы модуля 3 (US-8.2)", () => {
  it("их четыре и все проходят валидацию", () => {
    expect(cases).toHaveLength(4);
    for (const c of cases) expect(validateCase(c.file, c.data)).toEqual([]);
  });

  for (const c of cases) {
    it(`${c.data.id}: эталонный запрос проходит собственную проверку и возвращает строки`, () => {
      const { setup, referenceQuery, ordered } = c.data.sql;
      const outcome = runSqlCheck(engine, { setup, referenceQuery, userQuery: referenceQuery, ordered });
      expect(outcome).toEqual({ ok: true, message: "совпало" });
      const db = new engine.Database();
      db.exec(setup);
      expect(db.exec(referenceQuery)[0]?.values.length).toBeGreaterThan(0);
      db.close();
    });

    it(`${c.data.id}: схема совпадает со схемой песочницы`, () => {
      expect(c.data.sql.setup.replace(/\s+/g, " ").trim()).toBe(DEMO_SETUP.replace(/\s+/g, " ").trim());
    });
  }

  it("кейс 3 возвращает курс без студентов с нулём, кейс 4 отсекает студента без оценок", () => {
    const get = (id: string) => cases.find((c) => c.data.id === id)!.data.sql;
    const rows = (s: { setup: string; referenceQuery: string }) => {
      const db = new engine.Database();
      db.exec(s.setup);
      const r = db.exec(s.referenceQuery)[0].values;
      db.close();
      return r;
    };
    expect(rows(get("M3-CASE-03"))).toContainEqual(["Тестирование API", 0]);
    expect(rows(get("M3-CASE-04")).map((r) => r[0]).sort()).toEqual(["Анна", "Вера"]);
  });
});
