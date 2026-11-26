// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup, waitFor } from "@testing-library/react";
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

const validText = readFileSync(join(process.cwd(), "tests/fixtures/postman/school-valid.json"), "utf8");

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = "#/modules/9/cases";
});

/** Отвечает на вопросы кейса; wrong последних ответов выбираются неверно. */
async function passGate(caseId: string, wrong = 0) {
  const c = getCases("9").find((x) => x.id === caseId)!;
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

describe("страница кейсов модуля 9 (US-8.3)", () => {
  it("показывает четыре кейса с короткими заголовками шагов", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("9")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("без прохождения теории практика закрыта; две ошибки из шести оставляют её закрытой", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    expect(screen.queryByLabelText("Ваша коллекция Postman")).toBeNull();
    const card = await passGate("M9-CASE-01", 2);
    expect(within(card).getByText(/Порог не достигнут: верно 4 из 6, нужно не менее 5/)).toBeTruthy();
    expect(screen.queryByLabelText("Ваша коллекция Postman")).toBeNull();
  });

  it("с одной ошибкой из шести порог 75% проходится", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M9-CASE-01", 1);
    expect(within(card).getByText(/Порог пройден/)).toBeTruthy();
  });

  it("кейс 1: после теории загрузка верной коллекции засчитывает кейс и сохраняет прогресс", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M9-CASE-01");
    const input = within(card).getByLabelText("Ваша коллекция Postman");
    await userEvent.upload(input, new File([validText], "school.json", { type: "application/json" }));
    expect(await within(card).findByText(/Кейс засчитан/)).toBeTruthy();
    expect(within(card).getByText(/папка «Студенты» с тремя запросами/)).toBeTruthy();
    await waitFor(() => expect(loadProgress().cases["M9-CASE-01"]?.practice).toEqual({ answer: "school.json", submitted: true }));
  });

  it("кейс 4: ручной, после теории открывается поле ответа и чек-лист", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M9-CASE-04");
    expect(within(card).getByLabelText("Ваш ответ")).toBeTruthy();
    expect(within(card).queryByLabelText("Ваша коллекция Postman")).toBeNull();
  });
});
