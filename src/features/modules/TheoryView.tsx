import { useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { getTheory } from "../../content/loader";
import { InDevelopment } from "./InDevelopment";

export default function TheoryView() {
  const { id } = useParams();
  const parts = getTheory(id ?? "");
  if (parts.length === 0) {
    return <InDevelopment what="Теория" />;
  }
  return (
    <article className="theory">
      {parts.map((text, i) => (
        <Markdown key={i}>{text.replace(/^---[\s\S]*?---/, "")}</Markdown>
      ))}
    </article>
  );
}
