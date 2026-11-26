import { useParams } from "react-router-dom";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getTheoryParts } from "../../content/loader";
import { InDevelopment } from "./InDevelopment";
import { DownloadableCode } from "./DownloadableCode";

/**
 * Блок кода с пометкой file=имя в строке языка (```yaml file=api.yaml) — готовый документ:
 * для него показываются имя файла и кнопка «Скачать». Остальные блоки кода выводятся как обычно.
 */
const COMMON: Components = {
  pre: ({ node, children }) => {
    const code = node?.children[0];
    const meta = code && code.type === "element" ? (code.data as { meta?: string } | undefined)?.meta : undefined;
    const filename = /(?:^|\s)file=(\S+)/.exec(meta ?? "")?.[1];
    const first = code && code.type === "element" ? code.children[0] : undefined;
    const text = first && first.type === "text" ? first.value : "";
    return filename ? (
      <DownloadableCode filename={filename} text={text}>
        {children}
      </DownloadableCode>
    ) : (
      <pre>{children}</pre>
    );
  },
};

// В многоглавной теории заголовок главы — h2, поэтому заголовки внутри глав сдвигаются на уровень вниз.
const DEMOTED: Components = {
  ...COMMON,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
};

function goTo(id: string) {
  // Ссылка вида #id сломала бы маршрутизацию по хешу, поэтому прокручиваем программно.
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function TheoryView() {
  const { id } = useParams();
  const parts = getTheoryParts(id ?? "");
  if (parts.length === 0) {
    return <InDevelopment what="Теория" />;
  }
  const chapters = parts.length > 1;
  return (
    <article className="theory">
      {chapters && (
        <nav aria-label="Содержание" className="theory-toc">
          <h2>Содержание</h2>
          <ol>
            {parts.map((p, i) => (
              <li key={i}>
                <button type="button" onClick={() => goTo(`chapter-${i + 1}`)}>
                  {p.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {parts.map((p, i) => (
        <section key={i} className={chapters ? "theory-chapter" : undefined}>
          {chapters && (
            <h2 id={`chapter-${i + 1}`}>
              Глава {i + 1}. {p.title}
            </h2>
          )}
          <Markdown remarkPlugins={[remarkGfm]} components={chapters ? DEMOTED : COMMON}>
            {p.body}
          </Markdown>
        </section>
      ))}
    </article>
  );
}
