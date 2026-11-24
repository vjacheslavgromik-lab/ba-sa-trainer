import { useParams } from "react-router-dom";
import { Placeholder } from "./Placeholder";
import SqlSandboxView from "../sql/SqlSandboxView";

/** Вкладка «Тренажёры»: для модуля 3 — песочница SQL, для остальных модулей — заглушка. */
export default function TrainersView() {
  const { id } = useParams();
  if (id === "3") return <SqlSandboxView />;
  return <Placeholder title="Тренажёры" />;
}
