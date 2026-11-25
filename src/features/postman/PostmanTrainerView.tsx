import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { checkCollection, type CaseRules, type CheckOutcome } from "./checkCollection";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface Props {
  /** Правила кейса; без них проверяются только общие правила. */
  caseRules?: CaseRules;
}

/** Тренажёр Postman: загрузка коллекции из файла и список нарушений (US-5.2, US-6.2). */
export default function PostmanTrainerView({ caseRules }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<CheckOutcome | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setResult({ ok: false, error: "Файл слишком большой для коллекции Postman." });
      return;
    }
    setResult(checkCollection(await file.text(), caseRules));
  }

  return (
    <section aria-labelledby="postman-title" className="sandbox">
      <h2 id="postman-title">Тренажёр Postman</h2>
      <p className="muted">
        Загрузите коллекцию Postman (экспорт в формате Collection v2.1, JSON). Проверяется только структура: методы,
        адреса, тела запросов и проверки кодов ответа. Запросы к API не отправляются.
      </p>

      <Label htmlFor="postman-file" className="mb-1 block">
        Загрузить коллекцию (файл JSON)
      </Label>
      <input
        ref={input}
        id="postman-file"
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {result && (
        <div className="py-2">
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
                        {v.source && <span className="muted"> Источник: {v.source}.</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 py-2">
            <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
              Проверить снова
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
