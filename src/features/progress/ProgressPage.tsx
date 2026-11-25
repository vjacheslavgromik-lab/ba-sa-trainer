import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { downloadText } from "../../shared/downloadText";
import {
  loadProgress,
  parseProgress,
  saveProgress,
  serializeProgress,
  summarizeProgress,
  type Progress,
} from "./progress";

const MAX_FILE_BYTES = 1024 * 1024;

type Status = { kind: "ok" | "error"; text: string } | null;

function SummaryLine({ progress }: { progress: Progress }) {
  const s = summarizeProgress(progress);
  return (
    <>
      кейсов с данными — {s.cases}, проверок теории — {s.theoryAnswered}, отправленных практик — {s.practiceSent}
    </>
  );
}

/** Экран «Прогресс»: предупреждение о хранении, экспорт и импорт (US-7.2–7.4). */
export default function ProgressPage() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [pending, setPending] = useState<Progress | null>(null);
  const [status, setStatus] = useState<Status>(null);

  function exportFile() {
    const day = new Date().toISOString().slice(0, 10);
    downloadText(`ba-sa-progress-${day}.json`, serializeProgress(progress));
    setStatus({ kind: "ok", text: "Файл прогресса скачан." });
  }

  async function chooseFile(file: File | undefined) {
    setPending(null);
    setStatus(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus({ kind: "error", text: "Файл слишком большой для файла прогресса. Данные не изменены." });
      return;
    }
    const result = parseProgress(await file.text());
    if (!result.ok) {
      setStatus({ kind: "error", text: `${result.error} Данные не изменены.` });
      return;
    }
    setPending(result.progress);
  }

  function confirmImport() {
    if (!pending) return;
    saveProgress(pending);
    setProgress(pending);
    setPending(null);
    setStatus({ kind: "ok", text: "Прогресс восстановлен из файла." });
  }

  return (
    <section aria-labelledby="progress-title">
      <h1 id="progress-title">Прогресс</h1>
      <p className="feedback" role="note">
        Прогресс хранится только в этом браузере. Очистка данных браузера, другой браузер или другой компьютер — и он
        пропадёт. Сохраните файл прогресса заранее.
      </p>

      <p>
        Сейчас в браузере: <SummaryLine progress={progress} />.
      </p>

      <div className="flex gap-2 py-2">
        <Button type="button" onClick={exportFile}>
          Экспорт прогресса
        </Button>
      </div>

      <div className="py-2">
        <Label htmlFor="progress-import" className="mb-1 block">Импорт прогресса (файл JSON)</Label>
        <input
          id="progress-import"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void chooseFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {pending && (
        <div className="stage" role="group" aria-label="Предпросмотр импорта">
          <h2>Предпросмотр импорта</h2>
          <p>
            В файле: <SummaryLine progress={pending} />.
          </p>
          <p className="feedback feedback--bad">
            Текущий прогресс в браузере будет заменён: сейчас — <SummaryLine progress={progress} />.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={confirmImport}>
              Подтвердить импорт
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPending(null)}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite">
        {status && <p className={status.kind === "ok" ? "feedback feedback--ok" : "feedback feedback--bad"}>{status.text}</p>}
      </div>
    </section>
  );
}
