// Построение графика диаграммы классов тем же Mermaid, что и в ER-тренажёре (грузится лениво).
import { loadMermaid, type RenderOutcome } from "../er/renderEr";

let counter = 0;

export async function renderClass(source: string): Promise<RenderOutcome> {
  const mermaid = await loadMermaid();
  try {
    await mermaid.parse(source);
    const { svg } = await mermaid.render(`class-preview-${++counter}`, source);
    return { ok: true, svg };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
