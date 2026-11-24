import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { Placeholder } from "./Placeholder";

// Песочница и движок SQL грузятся только при открытии тренажёра модуля 3 (US-6.5, ADR-4).
const SqlSandboxView = lazy(() => import("../sql/SqlSandboxView"));

/** Вкладка «Тренажёры»: для модуля 3 — песочница SQL, для остальных модулей — заглушка. */
export default function TrainersView() {
  const { id } = useParams();
  if (id === "3") {
    return (
      <Suspense fallback={<p className="muted">Загрузка тренажёра…</p>}>
        <SqlSandboxView />
      </Suspense>
    );
  }
  return <Placeholder title="Тренажёры" />;
}
