import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkEr } from "./checkEr";
import { renderEr } from "./renderEr";

const DEBOUNCE_MS = 500;

const SAMPLE = `erDiagram
  STUDENT ||--o{ ENROLLMENT : "записан"
  COURSE ||--o{ ENROLLMENT : "включает"
  STUDENT {
    int id PK
    string name
    string city
  }
  COURSE {
    int id PK
    string title
    int price
  }
  ENROLLMENT {
    int student_id PK, FK
    int course_id PK, FK
    int grade
  }
`;

/** Тренажёр ER: поле ввода Mermaid, предпросмотр и замечания по правилам (US-5.3, US-6.3). */
export default function ErTrainerView() {
  const [text, setText] = useState(SAMPLE);
  const [settled, setSettled] = useState(SAMPLE);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Текст, для которого предпросмотр уже построен (или завершился ошибкой): по нему видно, идёт ли загрузка.
  const [rendered, setRendered] = useState<string | null>(null);

  // Пауза в вводе: предпросмотр и проверка обновляются через 500 мс после последнего символа.
  useEffect(() => {
    const t = setTimeout(() => setSettled(text), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (settled.trim() === "") return;
    let active = true;
    renderEr(settled)
      .then((r) => {
        if (!active) return;
        if (r.ok) {
          setSvg(r.svg);
          setError(null);
        } else {
          // Предпросмотр не ломается: последний удачный график остаётся на месте.
          setError(r.message);
        }
        setRendered(settled);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(`Не удалось загрузить Mermaid: ${e instanceof Error ? e.message : String(e)}`);
        setRendered(settled);
      });
    return () => {
      active = false;
    };
  }, [settled]);

  const empty = settled.trim() === "";
  const loading = !empty && rendered !== settled;

  const check = useMemo(() => checkEr(settled), [settled]);

  return (
    <section aria-labelledby="er-title" className="sandbox">
      <h2 id="er-title">Тренажёр ER-диаграммы</h2>
      <p className="muted">
        Опишите диаграмму в формате Mermaid erDiagram. Предпросмотр и замечания обновляются через {DEBOUNCE_MS} мс после
        паузы в вводе.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="er-source">Диаграмма (Mermaid)</Label>
          <Textarea
            id="er-source"
            rows={18}
            className="font-mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div>
          <h3>Предпросмотр</h3>
          {loading && svg === null && !empty && <p className="muted">Загрузка предпросмотра…</p>}
          {!empty && svg !== null && (
            <div
              role="img"
              aria-label="График ER-диаграммы"
              className="overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
          {empty && <p className="muted">Введите диаграмму, чтобы увидеть график.</p>}
          <div role="status" aria-live="polite">
            {!empty && error !== null && <pre className="feedback feedback--bad whitespace-pre-wrap">Ошибка в диаграмме: {error}</pre>}
          </div>
        </div>
      </div>

      <h3>Замечания</h3>
      {check.syntaxErrors.length > 0 ? (
        <>
          <p className="muted">Правила не проверены: сначала исправьте синтаксис.</p>
          <ul>
            {check.syntaxErrors.map((e, i) => (
              <li key={i}>
                Строка {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </>
      ) : check.remarks.length === 0 ? (
        <p className="feedback feedback--ok">Замечаний нет.</p>
      ) : (
        <ul>
          {check.remarks.map((r, i) => (
            <li key={i}>
              {r.message} <span className="muted">Источник: {r.source}.</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
