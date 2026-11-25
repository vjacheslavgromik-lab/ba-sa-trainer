// Mermaid грузится лениво, только на странице ER-тренажёра (US-6.5, риск «размер Mermaid» из плана S4).
import type { Mermaid } from "mermaid";

let mermaidPromise: Promise<Mermaid> | undefined;

export function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import("mermaid").then((m) => {
    m.default.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", suppressErrorRendering: true });
    return m.default;
  });
  return mermaidPromise;
}

export type RenderOutcome = { ok: true; svg: string } | { ok: false; message: string };

let counter = 0;

/** Строит SVG; синтаксическая ошибка возвращается текстом и ничего не рисует на странице. */
export async function renderEr(source: string): Promise<RenderOutcome> {
  const mermaid = await loadMermaid();
  try {
    await mermaid.parse(source);
    const { svg } = await mermaid.render(`er-preview-${++counter}`, source);
    return { ok: true, svg };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
