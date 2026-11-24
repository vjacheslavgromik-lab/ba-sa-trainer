import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { SqlSandbox } from "../../src/features/sql/sandbox";

let engine: SqlJsStatic;

beforeAll(async () => {
  const bytes = readFileSync(fileURLToPath(new URL("../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url)));
  const wasmBinary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  engine = await initSqlJs({ wasmBinary });
});

describe("SQL-песочница (US-6.1)", () => {
  it("выполняет SELECT и возвращает таблицу", () => {
    const sb = new SqlSandbox(engine);
    const out = sb.run("SELECT id, name FROM students ORDER BY id");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.columns).toEqual(["id", "name"]);
    expect(out.rows).toHaveLength(4);
    expect(out.rows[0]).toEqual([1, "Анна"]);
    expect(out.message).toBe("Строк: 4");
    sb.dispose();
  });

  it("возвращает текст ошибки для некорректного запроса, не падая", () => {
    const sb = new SqlSandbox(engine);
    const out = sb.run("SELEC * FRM students");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.message.length).toBeGreaterThan(0);
    sb.dispose();
  });

  it("сообщает о пустом запросе", () => {
    const sb = new SqlSandbox(engine);
    expect(sb.run("   ")).toEqual({ ok: false, message: "Введите запрос." });
    sb.dispose();
  });

  it("изменения данных видны в текущей сессии, сброс возвращает исходную базу", () => {
    const sb = new SqlSandbox(engine);
    const ins = sb.run("INSERT INTO students VALUES (5, 'Дарья', 'Тверь')");
    expect(ins).toEqual({ ok: true, columns: [], rows: [], message: "Выполнено. Изменено строк: 1" });

    const count = () => {
      const out = sb.run("SELECT COUNT(*) FROM students");
      return out.ok ? out.rows[0][0] : null;
    };
    expect(count()).toBe(5);

    sb.reset();
    expect(count()).toBe(4);
    sb.dispose();
  });

  it("новая песочница стартует с исходной базой, даже после изменений в другой", () => {
    const first = new SqlSandbox(engine);
    first.run("DELETE FROM enrollments");
    first.dispose();

    const second = new SqlSandbox(engine);
    const out = second.run("SELECT COUNT(*) FROM enrollments");
    expect(out.ok && out.rows[0][0]).toBe(5);
    second.dispose();
  });
});
