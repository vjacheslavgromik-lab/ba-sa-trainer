import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { validateCase, validateQuestion, validateTheoryFrontmatter, parseFrontmatter, type ValidationError } from "../src/content/validate";

const root = join(process.cwd(), "content", "modules");
const errors: ValidationError[] = [];
let checked = 0;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(root);
const questionIds = new Set<string>();
const caseQuestionRefs: { file: string; ids: string[] }[] = [];

for (const file of files) {
  const rel = relative(process.cwd(), file);
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".md")) {
    checked++;
    errors.push(...validateTheoryFrontmatter(rel, parseFrontmatter(text)));
  } else if (file.endsWith(".json")) {
    checked++;
    let data: any;
    try { data = JSON.parse(text); } catch { errors.push({ file: rel, path: "", message: "некорректный JSON" }); continue; }
    if (file.includes("/questions/")) {
      errors.push(...validateQuestion(rel, data));
      if (data?.id) questionIds.add(data.id);
    } else if (file.includes("/cases/")) {
      errors.push(...validateCase(rel, data));
      if (Array.isArray(data?.questions)) caseQuestionRefs.push({ file: rel, ids: data.questions });
    }
  }
}

for (const ref of caseQuestionRefs) {
  for (const id of ref.ids) {
    if (!questionIds.has(id)) errors.push({ file: ref.file, path: "questions", message: `вопрос «${id}» не найден` });
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e.file} [${e.path}] ${e.message}`);
  console.error(`\nНайдено ошибок: ${errors.length}`);
  process.exit(1);
}
console.log(`✓ Контент проверен: файлов ${checked}, ошибок нет`);
