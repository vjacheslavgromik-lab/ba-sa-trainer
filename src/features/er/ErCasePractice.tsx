// Практика ER-кейса: диаграмма Mermaid проверяется правилами тренажёра и правилами кейса (US-5.3, US-8.2).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseData } from "../../content/loader";
import { checkErCase, isErCaseSolved, type ErCaseResult } from "./checkErCase";

interface Props {
  data: CaseData;
  /** Последняя принятая диаграмма (из сохранённого прогресса). */
  initialText: string;
  /** Кейс уже решён (замечаний нет). */
  solved: boolean;
  /** Вызывается, когда замечаний нет. */
  onSolved: (text: string) => void;
}

const START = "erDiagram\n";

export default function ErCasePractice({ data, initialText, solved, onSolved }: Props) {
  const [text, setText] = useState(initialText || START);
  const [result, setResult] = useState<ErCaseResult | null>(null);
  const rules = data.er?.rules;
  if (!rules) return null;

  function check() {
    if (!rules) return;
    const r = checkErCase(text, rules);
    setResult(r);
    if (isErCaseSolved(r)) onSolved(text);
  }

  const id = `er-answer-${data.id}`;
  const total = result ? result.syntaxErrors.length + result.remarks.length + result.caseRemarks.length : 0;
  return (
    <div className="practice-answer">
      <Label htmlFor={id}>
        <strong>Ваша ER-диаграмма (Mermaid erDiagram)</strong>
      </Label>
      <p className="muted">
        Формат записи описан в главе 4 теории. Нарисовать график и посмотреть замечания по ходу работы можно в тренажёре
        ER (вкладка «Тренажёры»).
      </p>
      <Textarea
        id={id}
        rows={14}
        className="font-mono"
        value={text}
        disabled={solved}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
      />
      {!solved && (
        <Button type="button" onClick={check} disabled={text.trim().length === 0}>
          Проверить диаграмму
        </Button>
      )}
      <div role="status" aria-live="polite">
        {result && total === 0 && <p className="feedback feedback--ok">Замечаний нет.</p>}
        {result && result.syntaxErrors.length > 0 && (
          <>
            <p className="feedback feedback--bad">Правила не проверены: сначала исправьте синтаксис.</p>
            <ul>
              {result.syntaxErrors.map((e, i) => (
                <li key={i}>
                  Строка {e.line}: {e.message}
                </li>
              ))}
            </ul>
          </>
        )}
        {result && result.syntaxErrors.length === 0 && total > 0 && (
          <>
            <p className="feedback feedback--bad">Замечаний: {total}.</p>
            <ul>
              {result.remarks.map((r, i) => (
                <li key={`r${i}`}>
                  {r.message} <span className="muted">Источник: {r.source}.</span>
                </li>
              ))}
              {result.caseRemarks.map((r, i) => (
                <li key={`c${i}`}>{r.message}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      {solved ? (
        <>
          <p className="feedback feedback--ok">Кейс засчитан.</p>
          <h4>Эталонное решение</h4>
          <p>{data.reference}</p>
        </>
      ) : (
        <p className="muted">Эталонное решение появится после диаграммы без замечаний.</p>
      )}
    </div>
  );
}
