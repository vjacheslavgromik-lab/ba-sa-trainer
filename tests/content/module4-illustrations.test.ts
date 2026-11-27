import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getTheoryParts } from "../../src/content/loader";

const parts = getTheoryParts("4");
const IMG = /!\[([^\]]*)\]\(\.\/theory-images\/m4\/([\w-]+\.svg)\)\n\n\*(Рис\. \d+\.[^*]+)\*/g;
const figures = parts.flatMap((p, i) => [...p.body.matchAll(IMG)].map((m) => ({ chapter: i + 1, alt: m[1], file: m[2], caption: m[3] })));

describe("Теория модуля 4: иллюстрации", () => {
  it("семь рисунков в главах 2, 3, 4 и 8, подписи пронумерованы подряд", () => {
    expect(figures.map((f) => f.file)).toEqual([
      "er-anatomy.svg", "er-cardinality.svg", "er-notations.svg", "er-store.svg", "class-anatomy.svg", "class-relations.svg", "class-diagram.svg",
    ]);
    expect(figures.map((f) => f.chapter)).toEqual([2, 3, 4, 4, 8, 8, 8]);
    figures.forEach((f, i) => expect(f.caption.startsWith(`Рис. ${i + 1}.`), f.file).toBe(true));
  });

  it("у каждого рисунка есть описание (alt), файл существует и это корректный SVG с заголовком и описанием", () => {
    for (const f of figures) {
      expect(f.alt.length, f.file).toBeGreaterThan(15);
      const path = join(process.cwd(), "public/theory-images/m4", f.file);
      expect(existsSync(path), f.file).toBe(true);
      const svg = readFileSync(path, "utf8");
      expect(svg.startsWith("<svg "), f.file).toBe(true);
      expect(svg.trimEnd().endsWith("</svg>"), f.file).toBe(true);
      expect(svg, f.file).toMatch(/<title id="t">[^<]+<\/title>/);
      expect(svg, f.file).toMatch(/<desc id="d">[^<]+<\/desc>/);
      expect(svg, f.file).toMatch(/viewBox="0 0 \d+ \d+"/);
      const opens = (svg.match(/<(?!\/|\?|!)[a-zA-Z]+/g) ?? []).length;
      const closes = (svg.match(/<\/[a-zA-Z]+>|\/>/g) ?? []).length;
      expect(opens, f.file).toBe(closes);
    }
  });

  it("на рисунках нет текста за пределами холста", () => {
    for (const f of figures) {
      const svg = readFileSync(join(process.cwd(), "public/theory-images/m4", f.file), "utf8");
      const [w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!.slice(1).map(Number);
      for (const m of svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"/g)) {
        expect(Number(m[1]), `${f.file} x`).toBeLessThanOrEqual(w);
        expect(Number(m[2]), `${f.file} y`).toBeLessThanOrEqual(h);
      }
    }
  });
});
