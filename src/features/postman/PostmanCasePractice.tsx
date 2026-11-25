// Практика Postman-кейса: загруженная коллекция проверяется по общим правилам и правилам кейса (US-5.2, US-8.3).
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CaseData } from "../../content/loader";
import { checkCollection, type CheckOutcome } from "./checkCollection";
import { PostmanResult } from "./PostmanResult";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface Props {
  data: CaseData;
  /** Имя последнего принятого файла (из сохранённого прогресса). */
  initialFileName: string;
  /** Кейс уже решён (нарушений 0). */
  solved: boolean;
  /** Вызывается, когда в коллекции нет нарушений. */
  onSolved: (fileName: string) => void;
}

export default function PostmanCasePractice({ data, initialFileName, solved, onSolved }: Props) {
  const [fileName, setFileName] = useState<string | null>(initialFileName || null);
  const [result, setResult] = useState<CheckOutcome | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const rules = data.postman?.rules;
  if (!rules) return null;

  async function choose(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setResult({ ok: false, error: "Файл слишком большой для коллекции Postman." });
      return;
    }
    const outcome = checkCollection(await file.text(), rules);
    setResult(outcome);
    if (outcome.ok && outcome.violations.length === 0) onSolved(file.name);
  }

  const id = `postman-answer-${data.id}`;
  return (
    <div className="practice-answer">
      <Label htmlFor={id}>
        <strong>Ваша коллекция Postman</strong>
      </Label>
      <p className="muted">Экспортируйте коллекцию в формате Collection v2.1 (JSON) и загрузите файл. Запросы к API не отправляются.</p>
      <input
        ref={input}
        id={id}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {result && <PostmanResult result={result} fileName={fileName} />}
      {solved ? (
        <>
          <p className="feedback feedback--ok">Кейс засчитан{initialFileName ? `: коллекция «${initialFileName}»` : ""}.</p>
          <h4>Эталонное решение</h4>
          <p>{data.reference}</p>
        </>
      ) : (
        <>
          {result && (
            <div className="flex gap-2 py-2">
              <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
                Проверить снова
              </Button>
            </div>
          )}
          <p className="muted">Эталонное решение появится после коллекции без нарушений.</p>
        </>
      )}
    </div>
  );
}
