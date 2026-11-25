import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { compareResults } from "../../src/features/sql/compare";
import { runSqlCheck } from "../../src/features/sql/runSqlCheck";

const SETUP = `
  CREATE TABLE student (id INTEGER, name TEXT);
  INSERT INTO student VALUES (1, 'Анна'), (2, 'Борис'), (3, 'Вера');
`;
const REFERENCE = "SELECT id, name FROM student WHERE id >= 1";

let engine: SqlJsStatic;

beforeAll(async () => {
  const bytes = readFileSync(fileURLToPath(new URL("../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url)));
  const wasmBinary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  engine = await initSqlJs({ wasmBinary });
});

describe("сравнение результатов (US-5.1)", () => {
  const ref = { columns: ["id", "name"], rows: [[1, "Анна"], [2, "Борис"], [3, "Вера"]] };

  it("считает совпадением одинаковые строки в другом порядке", () => {
    const actual = { columns: ["id", "name"], rows: [[3, "Вера"], [1, "Анна"], [2, "Борис"]] };
    expect(compareResults(actual, ref)).toEqual({ ok: true, message: "совпало" });
  });

  it("сообщает число строк, если в результате меньше строк, чем в эталоне", () => {
    const actual = { columns: ["id", "name"], rows: [[1, "Анна"], [2, "Борис"]] };
    const outcome = compareResults(actual, ref);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("строк в результате 2, в эталоне 3");
  });

  it("не совпадает, если значения отличаются", () => {
    const actual = { columns: ["id", "name"], rows: [[1, "Анна"], [2, "Борис"], [3, "Ольга"]] };
    expect(compareResults(actual, ref).ok).toBe(false);
  });

  it("не совпадает, если число столбцов другое", () => {
    const actual = { columns: ["name"], rows: [["Анна"], ["Борис"], ["Вера"]] };
    expect(compareResults(actual, ref).message).toContain("столбцов");
  });

  it("при ordered не принимает другой порядок строк", () => {
    const actual = { columns: ["id", "name"], rows: [[3, "Вера"], [1, "Анна"], [2, "Борис"]] };
    const outcome = compareResults(actual, ref, true);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("порядок строк важен");
  });

  it("при ordered принимает тот же порядок строк", () => {
    expect(compareResults(ref, ref, true).ok).toBe(true);
  });
});

describe("проверка SQL на sql.js (US-5.1)", () => {
  it("совпадает при том же наборе строк в другом порядке", () => {
    const outcome = runSqlCheck(engine, {
      setup: SETUP,
      userQuery: "SELECT id, name FROM student WHERE id >= 1 ORDER BY id DESC",
      referenceQuery: REFERENCE,
    });
    expect(outcome).toEqual({ ok: true, message: "совпало" });
  });

  it("не совпадает с числом строк, если запрос вернул 2 из 3", () => {
    const outcome = runSqlCheck(engine, {
      setup: SETUP,
      userQuery: "SELECT id, name FROM student WHERE id >= 2",
      referenceQuery: REFERENCE,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe("не совпало: строк в результате 2, в эталоне 3");
  });

  it("возвращает ошибку запроса, не падая", () => {
    const outcome = runSqlCheck(engine, {
      setup: SETUP,
      userQuery: "SELECT nope FROM student",
      referenceQuery: REFERENCE,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.message.startsWith("ошибка в запросе:")).toBe(true);
  });

  it("каждая проверка создаёт новую базу: изменения данных не сохраняются", () => {
    const changed = runSqlCheck(engine, {
      setup: SETUP,
      userQuery: "DELETE FROM student",
      referenceQuery: REFERENCE,
    });
    expect(changed.ok).toBe(false);

    const again = runSqlCheck(engine, {
      setup: SETUP,
      userQuery: REFERENCE,
      referenceQuery: REFERENCE,
    });
    expect(again).toEqual({ ok: true, message: "совпало" });
  });
});
