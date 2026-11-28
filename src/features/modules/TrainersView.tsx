import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { InDevelopment } from "./InDevelopment";
import PostmanTrainerView from "../postman/PostmanTrainerView";

// Песочница и движок SQL грузятся только при открытии тренажёра модуля 3 (US-6.5, ADR-4).
const SqlSandboxView = lazy(() => import("../sql/SqlSandboxView"));
// Тренажёр ER и Mermaid грузятся только при открытии тренажёра модуля 4.
const ErTrainerView = lazy(() => import("../er/ErTrainerView"));
// Тренажёр диаграммы классов тоже открывается только на вкладке «Тренажёры» модуля 4 и использует тот же Mermaid.
const ClassTrainerView = lazy(() => import("../classdiagram/ClassTrainerView"));
// Тренажёр OpenAPI и библиотека разбора YAML грузятся только при открытии тренажёров модулей 9, 12 и выпускного проекта.
const OpenApiTrainerView = lazy(() => import("../openapi/OpenApiTrainerView"));

/**
 * Вкладка «Тренажёры»: для модуля 3 — песочница SQL, для модуля 4 — ER-тренажёр и тренажёр диаграммы классов, для модуля 9 — проверка Postman и OpenAPI,
 * для модуля 12 и выпускного проекта — проверка OpenAPI, для остальных модулей — заглушка.
 */
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
        <ClassTrainerView />
      </Suspense>
    );
  }
  if (id === "9") {
    return (
      <>
        <PostmanTrainerView />
        <Suspense fallback={<p className="muted">Загрузка тренажёра…</p>}>
          <OpenApiTrainerView />
        </Suspense>
      </>
    );
  }
  if (id === "12" || id === "final") {
    return (
      <Suspense fallback={<p className="muted">Загрузка тренажёра…</p>}>
        <OpenApiTrainerView />
      </Suspense>
    );
  }
  return <InDevelopment what="Тренажёры" />;
}
