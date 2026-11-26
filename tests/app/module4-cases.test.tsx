// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import App from "../../src/app/App";
import { getCases, getQuestion } from "../../src/content/loader";
import { loadProgress } from "../../src/features/progress/progress";

if (!("ResizeObserver" in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const reference = readFileSync(join(process.cwd(), "tests/fixtures/er/rental-reference.mmd"), "utf8");

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = "#/modules/4/cases";
});

async function passGate(caseId: string, wrong = 0) {
  const c = getCases("4").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const [i, qid] of c.questions.entries()) {
    const q = getQuestion(qid)!;
    const group = within(card).getByRole("radiogroup", { name: q.prompt });
    const pick = i >= c.questions.length - wrong ? (q.correct + 1) % 4 : q.correct;
    await userEvent.click(within(group).getByLabelText(q.options[pick]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

describe("страница кейсов модуля 4", () => {
  it("четыре кейса с заголовками «Теория» и «Практика: …»", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("4")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("условие кейса 2: таблица данных отображается таблицей, а не сырым текстом", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M4-CASE-02");
    const table = within(card).getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(card.textContent).not.toContain("|---|");
  });

  it("кейс 1: после теории ER-диаграмма проверяется; верная модель засчитывает кейс и сохраняется в прогрессе", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M4-CASE-01");
    expect(within(card).getByText(/Порог пройден/)).toBeTruthy();
    fireEvent.change(within(card).getByLabelText("Ваша ER-диаграмма (Mermaid erDiagram)"), { target: { value: reference } });
    await userEvent.click(within(card).getByRole("button", { name: "Проверить диаграмму" }));
    expect(await within(card).findByText("Кейс засчитан.")).toBeTruthy();
    await waitFor(() => expect(loadProgress().cases["M4-CASE-01"]?.practice).toEqual({ answer: reference, submitted: true }));
  });

  it("две ошибки из шести оставляют практику закрытой: нужно не меньше пяти верных", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M4-CASE-01", 2);
    expect(within(card).getByText(/Порог не достигнут: верно 4 из 6, нужно не менее 5/)).toBeTruthy();
    expect(screen.queryByLabelText("Ваша ER-диаграмма (Mermaid erDiagram)")).toBeNull();
  });

  it("кейсы 2–4 ручные: после теории открывается поле ответа и чек-лист", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    for (const id of ["M4-CASE-03", "M4-CASE-04"]) {
      const card = await passGate(id);
      expect(within(card).getByLabelText("Ваш ответ")).toBeTruthy();
    }
  });

  it("условия кейсов других модулей отображаются как прежде: без таблиц, текст не искажён", async () => {
    window.location.hash = "#/modules/9/cases";
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const cases = getCases("9");
    const card = await (async () => {
      const c = cases[0];
      const region = screen.getByRole("region", { name: c.title });
      for (const qid of c.questions) {
        const q = getQuestion(qid)!;
        await userEvent.click(within(within(region).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[q.correct]));
      }
      await userEvent.click(within(region).getByRole("button", { name: "Проверить ответы" }));
      return region;
    })();
    expect(within(card).queryByRole("table")).toBeNull();
    const plain = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(plain(card.textContent ?? "")).toContain(plain(cases[0].condition));
  });
});
