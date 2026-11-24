// SQL-песочница (US-6.1, ADR-4). Учебная база живёт в памяти вкладки:
// изменения видны до сброса или перезагрузки страницы. Тип SqlJsStatic — только для типов,
// сам движок передаётся снаружи (его грузит loadSqlEngine лениво).
import type { Database, SqlJsStatic } from "sql.js";

/** Учебная база для песочницы. Состав таблиц — черновик, уточняется при наполнении модуля 3 (US-8.2). */
export const DEMO_SETUP = `
  CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
  CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT NOT NULL, price INTEGER);
  CREATE TABLE enrollments (student_id INTEGER REFERENCES students(id), course_id INTEGER REFERENCES courses(id), grade INTEGER);
  INSERT INTO students VALUES (1, 'Анна', 'Москва'), (2, 'Борис', 'Казань'), (3, 'Вера', 'Москва'), (4, 'Глеб', NULL);
  INSERT INTO courses VALUES (1, 'SQL для аналитиков', 15000), (2, 'Основы требований', 8000), (3, 'API и интеграции', 12000);
  INSERT INTO enrollments VALUES (1, 1, 5), (1, 2, 4), (2, 1, 3), (3, 3, 5), (4, 2, NULL);
`;

export type SandboxOutcome =
  | { ok: true; columns: string[]; rows: unknown[][]; message: string }
  | { ok: false; message: string };

export class SqlSandbox {
  private db: Database;
  private readonly engine: SqlJsStatic;

  constructor(engine: SqlJsStatic) {
    this.engine = engine;
    this.db = this.create();
  }

  private create(): Database {
    const db = new this.engine.Database();
    db.exec(DEMO_SETUP);
    return db;
  }

  /** Выполняет запрос в текущей базе сессии. Возвращает таблицу или текст ошибки; не бросает исключений. */
  run(sql: string): SandboxOutcome {
    if (sql.trim() === "") return { ok: false, message: "Введите запрос." };
    try {
      const results = this.db.exec(sql);
      const last = results[results.length - 1];
      if (last) {
        return { ok: true, columns: last.columns, rows: last.values, message: `Строк: ${last.values.length}` };
      }
      return { ok: true, columns: [], rows: [], message: `Выполнено. Изменено строк: ${this.db.getRowsModified()}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Возвращает базу к исходному состоянию. */
  reset(): void {
    this.db.close();
    this.db = this.create();
  }

  dispose(): void {
    this.db.close();
  }
}
