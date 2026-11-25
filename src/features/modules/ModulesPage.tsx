import { Link } from "react-router-dom";
import { MODULES, PUBLISHED_WAVES, isModulePublished } from "../../data/modules";
import { Badge } from "@/components/ui/badge";

export default function ModulesPage() {
  return (
    <section aria-labelledby="modules-title">
      <h1 id="modules-title">Модули</h1>
      <p className="muted">
        Выбирайте модули в любом порядке. Модули выходят волнами: опубликованы волны {PUBLISHED_WAVES.join(", ")}, остальные
        помечены «В разработке».
      </p>
      <ul className="module-grid">
        {MODULES.map((m) => (
          <li key={m.id}>
            <Link className="module-card" to={`/modules/${m.id}`}>
              <span className="module-card__number">Модуль {m.number}</span>
              <span className="module-card__title">{m.title}</span>
              <span className="module-card__result">{m.result}</span>
              <span className="module-card__meta">
                {m.slice && <Badge tone="info">Срез</Badge>}
                <Badge tone="planned">Волна {m.wave}</Badge>
                {isModulePublished(m) ? <Badge tone="success">Доступен</Badge> : <Badge tone="planned">В разработке</Badge>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
