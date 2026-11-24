import { NavLink, Outlet, useParams } from "react-router-dom";
import { findModule } from "../../data/modules";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "theory", label: "Теория" },
  { to: "cases", label: "Кейсы" },
  { to: "trainers", label: "Тренажёры" },
];

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
  return (
    <section aria-labelledby="module-title">
      <p className="muted">Модуль {module.number}</p>
      <h1 id="module-title">{module.title}</h1>
      <p>{module.result}</p>
      <p>{module.slice && <Badge tone="info">Срез</Badge>}</p>
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
          </NavLink>
        ))}
      </nav>
      <div className="module-body">
        <Outlet />
      </div>
    </section>
  );
}
