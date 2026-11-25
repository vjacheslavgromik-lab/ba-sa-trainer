// Проверка SQL-ответа на sql.js (ADR-4). Движок грузится лениво, только при первой проверке.
// Каждая проверка создаёт новую базу из скрипта кейса, поэтому изменения данных не переживают проверку.
import type { Database, SqlJsStatic } from "sql.js";
import { compareResults, type CompareOutcome, type QueryResult } from "./compare";

export interface SqlCheckInput {
  /** Скрипт создания и наполнения тестовой базы из файла кейса. */
  setup: string;
  /** Запрос пользователя. */
  userQuery: string;
  /** Эталонный запрос. */
  referenceQuery: string;
  /** Учитывать порядок строк (для кейсов с ORDER BY). */
  ordered?: boolean;
}

let enginePromise: Promise<SqlJsStatic> | undefined;

/**
 * Лениво загружает движок sql.js (JS и WASM) и кэширует промис: повторные вызовы возвращают тот же движок.
 * Ссылка на WASM-файл тоже находится здесь, чтобы не попадать в основной бандл (US-6.5).
 */
export function loadSqlEngine(): Promise<SqlJsStatic> {
  enginePromise ??= Promise.all([import("sql.js"), import("sql.js/dist/sql-wasm.wasm?url")]).then(
    ([sql, wasm]) => sql.default({ locateFile: () => wasm.default }),
  );
  return enginePromise;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Выполняет запрос и возвращает последний результат; пустой ответ даёт пустую таблицу. */
function runQuery(db: Database, sql: string): QueryResult {
  const results = db.exec(sql);
  const last = results[results.length - 1];
  if (!last) return { columns: [], rows: [] };
  return { columns: last.columns, rows: last.values };
}

/** Проверка с уже загруженным движком: удобно для тестов и для повторного использования. */
export function runSqlCheck(engine: SqlJsStatic, input: SqlCheckInput): CompareOutcome {
  const db = new engine.Database();
  try {
    try {
      db.exec(input.setup);
    } catch (e) {
      return { ok: false, message: `ошибка в тестовой базе: ${errorText(e)}` };
    }

    let expected: QueryResult;
    try {
      expected = runQuery(db, input.referenceQuery);
    } catch (e) {
      return { ok: false, message: `ошибка в эталонном запросе: ${errorText(e)}` };
    }

    let actual: QueryResult;
    try {
      actual = runQuery(db, input.userQuery);
    } catch (e) {
      return { ok: false, message: `ошибка в запросе: ${errorText(e)}` };
    }

    return compareResults(actual, expected, input.ordered);
  } finally {
    db.close();
  }
}

/** Полная проверка: загружает движок (если ещё не загружен) и запускает проверку. */
export async function checkSqlAnswer(input: SqlCheckInput): Promise<CompareOutcome> {
  const engine = await loadSqlEngine();
  return runSqlCheck(engine, input);
}
