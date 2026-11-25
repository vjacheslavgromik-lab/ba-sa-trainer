import type { CheckOutcome } from "./checkCollection";

/** Результат проверки коллекции: сообщение и таблица нарушений (общий для тренажёра и кейсов). */
export function PostmanResult({ result, fileName }: { result: CheckOutcome; fileName: string | null }) {
  return (
    <>
      <div role="status" aria-live="polite">
        {!result.ok && <p className="feedback feedback--bad">{result.error}</p>}
        {result.ok && result.violations.length === 0 && (
          <p className="feedback feedback--ok">
            Нарушений нет. Проверено запросов: {result.requestCount}. Кейс можно отметить выполненным.
          </p>
        )}
        {result.ok && result.violations.length > 0 && (
          <p className="feedback feedback--bad">
            Нарушений: {result.violations.length}. Проверено запросов: {result.requestCount}.
          </p>
        )}
      </div>

      {result.ok && result.violations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Нарушения в коллекции {fileName}</caption>
            <thead>
              <tr>
                {["№", "Правило", "Запрос", "Нарушение"].map((h) => (
                  <th key={h} scope="col" className="border-b px-2 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.violations.map((v) => (
                <tr key={v.number}>
                  <td className="border-b px-2 py-1">{v.number}</td>
                  <td className="border-b px-2 py-1">
                    {v.rule}. {v.title}
                  </td>
                  <td className="border-b px-2 py-1">{v.location === "" ? "Вся коллекция" : v.location}</td>
                  <td className="border-b px-2 py-1">
                    {v.message}
                    {v.sources.length > 0 && (
                      <span className="muted block">
                        Источники:{" "}
                        {v.sources.map((src, i) => (
                          <span key={src.text}>
                            {i > 0 && "; "}
                            {src.url ? (
                              <a href={src.url} target="_blank" rel="noreferrer">
                                {src.text}
                              </a>
                            ) : (
                              src.text
                            )}
                          </span>
                        ))}
                        .
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
