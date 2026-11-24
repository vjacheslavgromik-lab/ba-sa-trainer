// Сравнение результата SQL-запроса с эталоном (US-5.1, ADR-4).
// Строки сравниваются без учёта порядка; число столбцов должно совпадать.

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface CompareOutcome {
  ok: boolean;
  message: string;
}

function rowKey(row: unknown[]): string {
  return JSON.stringify(row);
}

export function compareResults(actual: QueryResult, expected: QueryResult): CompareOutcome {
  if (actual.columns.length !== expected.columns.length) {
    return {
      ok: false,
      message: `не совпало: столбцов в результате ${actual.columns.length}, в эталоне ${expected.columns.length}`,
    };
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      ok: false,
      message: `не совпало: строк в результате ${actual.rows.length}, в эталоне ${expected.rows.length}`,
    };
  }
  const a = actual.rows.map(rowKey).sort();
  const e = expected.rows.map(rowKey).sort();
  const same = a.every((key, i) => key === e[i]);
  if (!same) {
    return { ok: false, message: "не совпало: значения строк отличаются от эталона" };
  }
  return { ok: true, message: "совпало" };
}
