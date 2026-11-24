import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getCases, getQuestion, type CaseData } from "../../content/loader";
import { PASS_THRESHOLD, emptyProgress, isPassed, loadProgress, saveProgress, scoreCase, type Progress } from "../progress/progress";
import { ProgressBar } from "../../shared/ui/ProgressBar";

export default function CasesView() {
  const { id } = useParams();
  const cases = getCases(id ?? "");
  if (cases.length === 0) {
    return <p className="muted">Кейсы для этого модуля появятся позже.</p>;
  }
  return (
    <div className="case-list">
      {cases.map((c) => (
        <CaseCard key={c.id} data={c} />
      ))}
    </div>
  );
}

function CaseCard({ data }: { data: CaseData }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const saved = progress.cases[data.id]?.answers ?? {};
  const [answers, setAnswers] = useState<Record<string, number>>(saved);
  const [submitted, setSubmitted] = useState(Object.keys(saved).length === data.questions.length);

  const savedPractice = progress.cases[data.id]?.practice;
  const [practiceText, setPracticeText] = useState<string>(savedPractice?.answer ?? "");
  const [practiceSent, setPracticeSent] = useState<boolean>(savedPractice?.submitted ?? false);

  const correct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const qid of data.questions) {
      const q = getQuestion(qid);
      if (q) map[qid] = q.correct;
    }
    return map;
  }, [data.questions]);

  const score = scoreCase(answers, correct);
  const passed = submitted && isPassed(score);

  function persist(patch: Partial<NonNullable<Progress["cases"][string]>>) {
    const base = progress ?? emptyProgress();
    const current = base.cases[data.id] ?? { answers: {} };
    const next: Progress = { ...base, cases: { ...base.cases, [data.id]: { ...current, ...patch } } };
    setProgress(next);
    saveProgress(next);
  }

  function submit() {
    persist({ answers });
    setSubmitted(true);
  }

  function retry() {
    setAnswers({});
    setSubmitted(false);
  }

  function sendPractice() {
    persist({ practice: { answer: practiceText, submitted: true } });
    setPracticeSent(true);
  }

  return (
    <section className="case-card" aria-labelledby={`case-${data.id}`}>
      <h2 id={`case-${data.id}`}>{data.title}</h2>

      <section className="stage" aria-labelledby={`theory-check-${data.id}`}>
        <h3 id={`theory-check-${data.id}`}>Шаг 1. Проверка теории</h3>
        <p className="muted">
          Ответьте на вопросы. Практический кейс откроется, если верно не менее {Math.round(PASS_THRESHOLD * 100)}%.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {data.questions.map((qid, idx) => {
            const q = getQuestion(qid);
            if (!q) return null;
            return (
              <fieldset key={qid} className="question" disabled={submitted}>
                <legend>
                  {idx + 1}. {q.prompt}
                </legend>
                {q.options.map((opt, oi) => (
                  <label key={oi} className="option">
                    <input
                      type="radio"
                      name={qid}
                      checked={answers[qid] === oi}
                      onChange={() => setAnswers({ ...answers, [qid]: oi })}
                    />{" "}
                    {opt}
                  </label>
                ))}
                {submitted && (
                  <p className={answers[qid] === q.correct ? "feedback feedback--ok" : "feedback feedback--bad"}>
                    {answers[qid] === q.correct ? "Верно" : "Неверно"} · раздел теории: {q.theoryRef}
                  </p>
                )}
              </fieldset>
            );
          })}
          {!submitted && (
            <button type="submit" disabled={Object.keys(answers).length < data.questions.length}>
              Проверить ответы
            </button>
          )}
        </form>

        {submitted && (
          <>
            <ProgressBar value={Math.round(score * data.questions.length)} max={data.questions.length} label="Верных ответов" />
            {passed ? (
              <p className="feedback feedback--ok">Порог пройден. Практический кейс открыт.</p>
            ) : (
              <>
                <p className="feedback feedback--bad">Порог не достигнут. Перечитайте теорию и пройдите вопросы заново.</p>
                <button type="button" onClick={retry}>
                  Пройти заново
                </button>
              </>
            )}
          </>
        )}
      </section>

      <section className="stage" aria-labelledby={`practice-${data.id}`}>
        <h3 id={`practice-${data.id}`}>Шаг 2. Практический кейс</h3>
        {passed ? (
          <>
            <h4>Задание</h4>
            <p>{data.condition}</p>

            <div className="practice-answer">
              <label htmlFor={`answer-${data.id}`}>
                <strong>Ваш ответ</strong>
              </label>
              <textarea
                id={`answer-${data.id}`}
                rows={10}
                value={practiceText}
                disabled={practiceSent}
                onChange={(e) => setPracticeText(e.target.value)}
              />
              {!practiceSent && (
                <button type="button" onClick={sendPractice} disabled={practiceText.trim().length === 0}>
                  Отправить ответ
                </button>
              )}
            </div>

            {practiceSent ? (
              <>
                <h4>Чек-лист</h4>
                <ul>
                  {data.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <h4>Эталонное решение</h4>
                <p>{data.reference}</p>
              </>
            ) : (
              <p className="muted">Чек-лист и эталонное решение появятся после отправки ответа.</p>
            )}
          </>
        ) : (
          <p className="muted">Кейс откроется после прохождения проверки теории.</p>
        )}
      </section>
    </section>
  );
}
