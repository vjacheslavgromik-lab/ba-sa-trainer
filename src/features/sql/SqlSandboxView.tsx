import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SqlSandbox, type SandboxOutcome } from "./sandbox";
import { loadSqlEngine } from "./runSqlCheck";

const START_QUERY = "SELECT * FROM students;";

export default function SqlSandboxView() {
  const [sandbox, setSandbox] = useState<SqlSandbox | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState(START_QUERY);
  const [outcome, setOutcome] = useState<SandboxOutcome | null>(null);

  useEffect(() => {
    let active = true;
    let created: SqlSandbox | undefined;
    loadSqlEngine()
      .then((engine) => {
        if (!active) return;
        created = new SqlSandbox(engine);
        setSandbox(created);
      })
      .catch((e: unknown) => {
        if (active) setLoadError(`Не удалось загрузить движок SQL: ${e instanceof Error ? e.message : String(e)}`);
      });
    return () => {
      active = false;
      created?.dispose();
    };
  }, []);

  function run() {
    if (!sandbox) return;
    setOutcome(sandbox.run(query));
  }

  function reset() {
    if (!sandbox) return;
    sandbox.reset();
    setOutcome({ ok: true, columns: [], rows: [], message: "База сброшена к исходному состоянию." });
  }

  if (loadError) return <p className="feedback feedback--bad">{loadError}</p>;

  return (
    <section aria-labelledby="sandbox-title" className="sandbox">
      <h2 id="sandbox-title">Песочница SQL</h2>
      <p className="muted">
        Таблицы: students (id, name, city), courses (id, title, price), enrollments (student_id, course_id, grade).
        Изменения сохраняются до сброса базы или перезагрузки страницы.
      </p>

      <Label htmlFor="sandbox-query">Запрос</Label>
      <Textarea
        id="sandbox-query"
        rows={6}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
        }}
        className="font-mono"
      />

      <div className="flex gap-2 py-2">
        <Button type="button" onClick={run} disabled={!sandbox}>
          {sandbox ? "Выполнить" : "Загрузка движка…"}
        </Button>
        <Button type="button" variant="secondary" onClick={reset} disabled={!sandbox}>
          Сбросить базу
        </Button>
      </div>

      <div role="status" aria-live="polite">
        {outcome && !outcome.ok && <p className="feedback feedback--bad">Ошибка: {outcome.message}</p>}
        {outcome && outcome.ok && <p className="muted">{outcome.message}</p>}
      </div>

      {outcome && outcome.ok && outcome.columns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {outcome.columns.map((c, i) => (
                  <th key={i} scope="col" className="border-b px-2 py-1 text-left font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outcome.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border-b px-2 py-1">
                      {cell === null ? <span className="muted">NULL</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
