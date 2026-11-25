import { NavLink, Outlet, useParams } from "react-router-dom";
import { MODULES_WITH_TRAINER, findModule, isModulePublished } from "../../data/modules";
import { getCases, getTheory } from "../../content/loader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "theory", label: "Теория", key: "theory" },
  { to: "cases", label: "Кейсы", key: "cases" },
  { to: "trainers", label: "Тренажёры", key: "trainers" },
] as const;

export default function ModulePage() {
  const { id } = useParams();
  const module = findModule(id);
  if (!module) {
    return (
      <section>
        <h1>Модуль не найден</h1>
        <p>Проверьте ссылку или вернитесь к списку модулей.</p>
        <NavLink to="/modules">К списку модулей</NavLink>
      </section>
    );
  }
  // Раздел без содержимого помечается «В разработке», теория при этом остаётся доступной (US-8.4).
  const available = {
    theory: getTheory(module.id).length > 0,
    cases: getCases(module.id).length > 0,
    trainers: MODULES_WITH_TRAINER.includes(module.id),
  };
  return (
    <section aria-labelledby="module-title">
      <p className="muted">Модуль {module.number}</p>
      <h1 id="module-title">{module.title}</h1>
      <p>{module.result}</p>
      <p className="flex flex-wrap gap-2">
        {module.slice && <Badge tone="info">Срез</Badge>}
        <Badge tone="planned">Волна {module.wave}</Badge>
        {!isModulePublished(module) && <Badge tone="planned">Модуль в разработке</Badge>}
      </p>
      <nav aria-label="Разделы модуля" className="tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-4 py-3 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]",
                isActive
                  ? "border-[var(--accent-primary)] font-semibold text-[var(--accent-primary)]"
                  : "border-transparent text-[var(--text-secondary)]",
              )
            }
          >
            {t.label}
            {!available[t.key] && <span className="ml-2 text-xs font-normal">· В разработке</span>}
          </NavLink>
        ))}
      </nav>
      <div className="module-body">
        <Outlet />
      </div>
    </section>
  );
}
