import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { Placeholder } from "./Placeholder";

// Песочница и движок SQL грузятся только при открытии тренажёра модуля 3 (US-6.5, ADR-4).
const SqlSandboxView = lazy(() => import("../sql/SqlSandboxView"));
// Тренажёр ER и Mermaid грузятся только при открытии тренажёра модуля 4.
const ErTrainerView = lazy(() => import("../er/ErTrainerView"));

/** Вкладка «Тренажёры»: для модуля 3 — песочница SQL, для модуля 4 — ER-тренажёр, для остальных модулей — заглушка. */
export default function TrainersView() {
  const { id } = useParams();
  if (id === "3") {
    return (
      <Suspense fallback={<p className="muted">Загрузка тренажёра…</p>}>
        <SqlSandboxView />
      </Suspense>
    );
  }
  if (id === "4") {
    return (
      <Suspense fallback={<p className="muted">Загрузка тренажёра…</p>}>
        <ErTrainerView />
      </Suspense>
    );
  }
  return <Placeholder title="Тренажёры" />;
}
