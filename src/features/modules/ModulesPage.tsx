import { Link } from "react-router-dom";
import { MODULES, STATUS_LABEL } from "../../data/modules";
import { Badge } from "@/components/ui/badge";

export default function ModulesPage() {
  return (
    <section aria-labelledby="modules-title">
      <h1 id="modules-title">Модули</h1>
      <p className="muted">Выбирайте модули в любом порядке. Статусы пока показывают только начальное состояние.</p>
      <ul className="module-grid">
        {MODULES.map((m) => (
          <li key={m.id}>
            <Link className="module-card" to={`/modules/${m.id}`}>
              <span className="module-card__number">Модуль {m.number}</span>
              <span className="module-card__title">{m.title}</span>
              <span className="module-card__result">{m.result}</span>
              <span className="module-card__meta">
                {m.slice && <Badge tone="info">Срез</Badge>}
                <Badge tone="planned">{STATUS_LABEL.not_started}</Badge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
