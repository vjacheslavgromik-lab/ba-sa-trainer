import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { moduleLabel, neighbours } from "../../data/modules";

interface Props {
  moduleId: string;
  /** Вкладка, на которой пользователь сейчас: theory, cases или trainers. Её сохраняют при переходе. */
  tab: string;
  /** Подпись области навигации: на странице две такие области, вверху и внизу. */
  label: string;
}

function toTop() {
  // Хеш-маршрутизатор не прокручивает страницу сам, поэтому возвращаем её к началу вручную.
  document.documentElement.scrollTop = 0;
}

export function ModuleNav({ moduleId, tab, label }: Props) {
  const { prev, next } = neighbours(moduleId);
  return (
    <nav aria-label={label} className="module-nav">
      {prev ? (
        <Button asChild variant="secondary" className="module-nav__link">
          <Link to={`/modules/${prev.id}/${tab}`} onClick={toTop}>
            <span aria-hidden="true">←</span> Назад: {moduleLabel(prev)}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      {next ? (
        <Button asChild variant="secondary" className="module-nav__link">
          <Link to={`/modules/${next.id}/${tab}`} onClick={toTop}>
            Вперёд: {moduleLabel(next)} <span aria-hidden="true">→</span>
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
