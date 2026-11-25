import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { checkCollection, type CaseRules, type CheckOutcome } from "./checkCollection";
import { PostmanResult } from "./PostmanResult";

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
          <PostmanResult result={result} fileName={fileName} />
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
