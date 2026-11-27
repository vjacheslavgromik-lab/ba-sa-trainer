import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { getTheoryParts } from "../../src/content/loader";
import { DEMO_SETUP } from "../../src/features/sql/sandbox";

let engine: SqlJsStatic;
beforeAll(async () => {
  engine = await initSqlJs({ wasmBinary: readFileSync(join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm")) as never });
});

const chapter = getTheoryParts("3").find((p) => p.title === "Соединения, агрегаты и группировка")!;
const subqueries = chapter.body.slice(chapter.body.indexOf("## 3. Подзапросы"), chapter.body.indexOf("## 4. Соединения таблиц"));
const queries = [...subqueries.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);

function run(sql: string): unknown[][] {
  const db = new engine.Database();
  try {
    db.exec(DEMO_SETUP);
    return db.exec(sql)[0]?.values ?? [];
  } finally {
    db.close();
  }
}

describe("Теория модуля 3: примеры подзапросов", () => {
  it("в разделе «Подзапросы» три примера: со значением, со списком и то же соединением", () => {
    expect(queries).toHaveLength(3);
    expect(queries[0]).toContain("(SELECT AVG(price) FROM courses)");
    expect(queries[1]).toContain("IN (SELECT student_id");
    expect(queries[2]).toContain("JOIN enrollments");
  });

  it("пример 1: курсы дороже среднего — два курса, как сказано в тексте", () => {
    expect(run("SELECT AVG(price) FROM courses")).toEqual([[11250]]);
    expect(run(queries[0])).toEqual([
      ["SQL для аналитиков", 15000],
      ["API и интеграции", 12000],
    ]);
    expect(subqueries).toContain("11250");
  });

  it("пример 2: на курсе 2 записаны Анна и Глеб, соединение даёт тот же набор без дублей", () => {
    const sub = run(queries[1]).flat();
    expect(sub.sort()).toEqual(["Анна", "Глеб"]);
    const join = run(queries[2]).flat();
    expect(join.sort()).toEqual(sub);
    expect(new Set(join).size).toBe(join.length);
  });
});
