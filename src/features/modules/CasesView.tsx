import { lazy, Suspense, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "react-router-dom";
import { getCases, getQuestion, type CaseData } from "../../content/loader";
import { PASS_THRESHOLD, emptyProgress, isPassed, loadProgress, requiredCorrect, saveProgress, scoreCase, type Progress } from "../progress/progress";
import { InDevelopment } from "./InDevelopment";
import PostmanCasePractice from "../postman/PostmanCasePractice";
import ErCasePractice from "../er/ErCasePractice";
import { ProgressBar } from "../../shared/ui/ProgressBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

// Движок SQL грузится только для кейсов типа sql (US-6.5).
const SqlCasePractice = lazy(() => import("../sql/SqlCasePractice"));

export default function CasesView() {
  const { id } = useParams();
  const cases = getCases(id ?? "");
  if (cases.length === 0) {
    return <InDevelopment what="Кейсы" />;
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
  const [checks, setChecks] = useState<boolean[]>(
    savedPractice?.checks ?? data.checklist.map(() => false),
  );

  const correct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const qid of data.questions) {
      const q = getQuestion(qid);
      if (q) map[qid] = q.correct;
    }
    return map;
  }, [data.questions]);

  const score = scoreCase(answers, correct);
  const total = data.questions.length;
  const rightCount = Math.round(score * total);
  const needed = requiredCorrect(total);
  const passed = submitted && rightCount >= needed;

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
    persist({ answers: {} });
  }

  function sendPractice() {
    persist({ practice: { answer: practiceText, submitted: true, checks } });
    setPracticeSent(true);
  }

  function toggleCheck(index: number, value: boolean) {
    const next = checks.map((c, i) => (i === index ? value : c));
    setChecks(next);
    if (practiceSent) persist({ practice: { answer: practiceText, submitted: true, checks: next } });
  }

  const isSqlCase = data.check.type === "sql" && data.sql !== undefined;
  const isPostmanCase = data.check.type === "postman" && data.postman !== undefined;
  const isErCase = data.check.type === "er" && data.er !== undefined;
  const doneCount = checks.filter(Boolean).length;
  const checkScore = checks.length === 0 ? 0 : doneCount / checks.length;

  return (
    <section className="case-card" aria-label={data.title}>
      <section className="stage" aria-labelledby={`theory-check-${data.id}`}>
        <h3 id={`theory-check-${data.id}`}>Теория</h3>
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
                <RadioGroup
                  disabled={submitted}
                  value={answers[qid] === undefined ? "" : String(answers[qid])}
                  onValueChange={(v) => setAnswers((prev) => ({ ...prev, [qid]: Number(v) }))}
                  aria-label={q.prompt}
                >
                  {q.options.map((opt, oi) => {
                    const id = `${qid}-opt-${oi}`;
                    return (
                      <div key={oi} className="flex items-center gap-2 py-1">
                        <RadioGroupItem id={id} value={String(oi)} />
                        <Label htmlFor={id}>{opt}</Label>
                      </div>
                    );
                  })}
                </RadioGroup>
                {submitted && (
                  <>
                    <p className={answers[qid] === q.correct ? "feedback feedback--ok" : "feedback feedback--bad"}>
                      {answers[qid] === q.correct ? "Верно" : "Неверно"} · источник: {q.theoryRef}
                    </p>
                    {answers[qid] !== q.correct && (
                      <p className="feedback">Правильный ответ: {q.options[q.correct]}</p>
                    )}
                  </>
                )}
              </fieldset>
            );
          })}
          {!submitted && (
            <Button type="submit" disabled={Object.keys(answers).length < data.questions.length}>
              Проверить ответы
            </Button>
          )}
        </form>

        {submitted && (
          <>
            <ProgressBar value={rightCount} max={total} label="Верных ответов" />
            {passed ? (
              <p className="feedback feedback--ok">Порог пройден. Практический кейс открыт.</p>
            ) : (
              <>
                    <p className="feedback feedback--bad">
                      Порог не достигнут: верно {rightCount} из {total}, нужно не менее {needed}. Перечитайте теорию и пройдите вопросы заново.
                    </p>
                    <Button type="button" variant="secondary" onClick={retry}>
                      Пройти заново
                    </Button>
              </>
            )}
          </>
        )}
      </section>

      <section className="stage" aria-labelledby={`practice-${data.id}`}>
        <h3 id={`practice-${data.id}`}>Практика: «{data.title}»</h3>
        {passed ? (
          <>
            <h4>Задание</h4>
            {/* Условие может содержать таблицу данных и абзацы: выводим как Markdown. */}
            <div className="case-condition">
              <Markdown remarkPlugins={[remarkGfm]}>{data.condition}</Markdown>
            </div>

            {isErCase ? (
              <ErCasePractice
                data={data}
                initialText={savedPractice?.answer ?? ""}
                solved={practiceSent}
                onSolved={(text) => {
                  persist({ practice: { answer: text, submitted: true } });
                  setPracticeSent(true);
                }}
              />
            ) : isPostmanCase ? (
              <PostmanCasePractice
                data={data}
                initialFileName={savedPractice?.answer ?? ""}
                solved={practiceSent}
                onSolved={(fileName) => {
                  persist({ practice: { answer: fileName, submitted: true } });
                  setPracticeSent(true);
                }}
              />
            ) : isSqlCase ? (
              <Suspense fallback={<p className="muted">Загрузка проверки SQL…</p>}>
                <SqlCasePractice
                  data={data}
                  initialQuery={savedPractice?.answer ?? ""}
                  solved={practiceSent}
                  onSolved={(query) => {
                    persist({ practice: { answer: query, submitted: true } });
                    setPracticeSent(true);
                  }}
                />
              </Suspense>
            ) : (
              <>
                <div className="practice-answer">
                  <label htmlFor={`answer-${data.id}`}>
                    <strong>Ваш ответ</strong>
                  </label>
                  <Textarea
                    id={`answer-${data.id}`}
                    rows={10}
                    value={practiceText}
                    disabled={practiceSent}
                    onChange={(e) => setPracticeText(e.target.value)}
                  />
                  {!practiceSent && (
                    <Button type="button" onClick={sendPractice} disabled={practiceText.trim().length === 0}>
                      Отправить ответ
                    </Button>
                  )}
                </div>

                {practiceSent ? (
                  <>
                    <h4>Проверка по чек-листу</h4>
                    <p className="muted">Отметьте пункты, которые ваш ответ выполняет. Выполнено: {doneCount} из {data.checklist.length}.</p>
                    {isPassed(checkScore) ? (
                      <p className="feedback feedback--ok">Кейс засчитан: выполнено не менее {Math.round(PASS_THRESHOLD * 100)}% пунктов.</p>
                    ) : (
                      <p className="feedback feedback--bad">Кейс не засчитан: нужно выполнить не менее {Math.round(PASS_THRESHOLD * 100)}% пунктов.</p>
                    )}
                    <ul className="checklist">
                      {data.checklist.map((item, i) => {
                        const id = `${data.id}-check-${i}`;
                        return (
                          <li key={item} className="flex items-center gap-2 py-1">
                            <Checkbox id={id} checked={checks[i]} onCheckedChange={(v) => toggleCheck(i, v === true)} />
                            <Label htmlFor={id}>{item}</Label>
                          </li>
                        );
                      })}
                    </ul>
                    <h4>Эталонное решение</h4>
                    <div className="case-condition">
                      <Markdown remarkPlugins={[remarkGfm]}>{data.reference}</Markdown>
                    </div>
                  </>
                ) : (
                  <p className="muted">Чек-лист и эталонное решение появятся после отправки ответа.</p>
                )}
              </>
            )}
          </>
        ) : (
          <p className="muted">
            Кейс откроется после прохождения проверки теории{submitted ? `: верно ${rightCount} из ${total}, нужно не менее ${needed}` : ""}.
          </p>
        )}
      </section>
    </section>
  );
}
