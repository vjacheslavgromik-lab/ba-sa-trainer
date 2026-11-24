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

  function retry() {
    setAnswers({});
    setSubmitted(false);
  }

  function submit() {
    const next: Progress = { ...(progress ?? emptyProgress()), cases: { ...progress.cases, [data.id]: { answers } } };
    setProgress(next);
    saveProgress(next);
    setSubmitted(true);
  }

  return (
    <section className="case-card" aria-labelledby={`case-${data.id}`}>
      <h2 id={`case-${data.id}`}>{data.title}</h2>
      <h3>Задание</h3>
      <p>{data.condition}</p>

      <h3>Проверка теории</h3>
      <p className="muted">Ответьте на вопросы. Кейс откроется, если верно не менее {Math.round(PASS_THRESHOLD * 100)}%.</p>
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
          {!passed && (
            <p className="feedback feedback--bad">
              Порог не достигнут. Перечитайте теорию и пройдите вопросы заново.
            </p>
          )}
          {!passed && (
            <button type="button" onClick={retry}>
              Пройти заново
            </button>
          )}
        </>
      )}

      {passed ? (
        <>
          <h3>Чек-лист</h3>
          <ul>
            {data.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Эталонное решение</h3>
          <p>{data.reference}</p>
        </>
      ) : (
        <p className="muted">Эталонное решение и чек-лист откроются после прохождения теории.</p>
      )}
    </section>
  );
}
