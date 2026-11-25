// Практика SQL-кейса: запрос пользователя проверяется на sql.js и сравнивается с эталоном (US-5.1, US-8.2).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseData } from "../../content/loader";
import { checkSqlAnswer } from "./runSqlCheck";

interface Props {
  data: CaseData;
  /** Последний сохранённый запрос. */
  initialQuery: string;
  /** Кейс уже решён (результат совпал с эталоном). */
  solved: boolean;
  /** Вызывается, когда запрос совпал с эталоном. */
  onSolved: (query: string) => void;
}

export default function SqlCasePractice({ data, initialQuery, solved, onSolved }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const sql = data.sql;
  if (!sql) return null;

  async function check() {
    if (!sql) return;
    setChecking(true);
    try {
      const outcome = await checkSqlAnswer({
        setup: sql.setup,
        referenceQuery: sql.referenceQuery,
        userQuery: query,
        ordered: sql.ordered,
      });
      setMessage({ ok: outcome.ok, text: outcome.ok ? "Результат совпал с эталоном." : `Результат не совпал: ${outcome.message}` });
      if (outcome.ok) onSolved(query);
    } catch (e) {
      setMessage({ ok: false, text: `Не удалось выполнить проверку: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="practice-answer">
      <Label htmlFor={`sql-answer-${data.id}`}>
        <strong>Ваш запрос</strong>
      </Label>
      <Textarea
        id={`sql-answer-${data.id}`}
        rows={6}
        className="font-mono"
        value={query}
        disabled={solved}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!solved && (
        <Button type="button" onClick={check} disabled={checking || query.trim().length === 0}>
          {checking ? "Проверка…" : "Проверить запрос"}
        </Button>
      )}
      <div role="status" aria-live="polite">
        {message && <p className={message.ok ? "feedback feedback--ok" : "feedback feedback--bad"}>{message.text}</p>}
      </div>
      {solved ? (
        <>
          <p className="feedback feedback--ok">Кейс засчитан.</p>
          <h4>Эталонное решение</h4>
          <p>{data.reference}</p>
        </>
      ) : (
        <p className="muted">Эталонное решение появится после верного запроса.</p>
      )}
    </div>
  );
}
