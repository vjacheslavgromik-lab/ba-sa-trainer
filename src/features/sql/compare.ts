// Сравнение результата SQL-запроса с эталоном (US-5.1, ADR-4).
// По умолчанию строки сравниваются без учёта порядка; для кейсов с ORDER BY порядок включается флагом ordered.
// Число столбцов должно совпадать.

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

export function compareResults(actual: QueryResult, expected: QueryResult, ordered = false): CompareOutcome {
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
  const a = actual.rows.map(rowKey);
  const e = expected.rows.map(rowKey);
  if (!ordered) {
    a.sort();
    e.sort();
  }
  if (!a.every((key, i) => key === e[i])) {
    const hint = ordered ? " (порядок строк важен)" : "";
    return { ok: false, message: `не совпало: значения строк отличаются от эталона${hint}` };
  }
  return { ok: true, message: "совпало" };
}
