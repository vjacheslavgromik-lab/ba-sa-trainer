// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/app/App";
import { loadProgress } from "../../src/features/progress/progress";
import { getCases, getQuestion } from "../../src/content/loader";

if (!("ResizeObserver" in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = "#/modules/7/cases";
});

async function passGate(caseId: string) {
  const c = getCases("7").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const qid of c.questions) {
    const q = getQuestion(qid)!;
    const group = within(card).getByRole("radiogroup", { name: q.prompt });
    await userEvent.click(within(group).getByLabelText(q.options[q.correct]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

describe("страница кейсов модуля 7", () => {
  it("вкладка кейсов доступна, четыре карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("7")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("условие кейса 1: требования отображаются списком из шести пунктов", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M7-CASE-01");
    expect(within(card).getAllByRole("listitem").filter((li) => /Visa|пул соединений|быстро/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(3);
  });

  it("эталон кейса 2 показан блоком кода Gherkin после отправки ответа", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M7-CASE-02");
    await userEvent.type(within(card).getByLabelText("Ваш ответ"), "Feature: Отмена записи");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    const pre = card.querySelector("pre");
    expect(pre?.textContent).toContain("Scenario Outline:");
    expect(pre?.textContent).toContain("Examples:");
  });

  it("«Пройти заново» очищает сохранённые ответы: после перезагрузки страницы прежний провал не возвращается", async () => {
    const { unmount } = render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const c = getCases("7")[0];
    const card = screen.getByRole("region", { name: c.title });
    for (const [i, qid] of c.questions.entries()) {
      const q = getQuestion(qid)!;
      const pick = i < 2 ? (q.correct + 1) % 4 : q.correct;
      await userEvent.click(within(within(card).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[pick]));
    }
    await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
    expect(within(card).getByText(/Порог не достигнут/)).toBeTruthy();
    await userEvent.click(within(card).getByRole("button", { name: "Пройти заново" }));
    expect(loadProgress().cases[c.id]?.answers).toEqual({});
    unmount();
    cleanup();
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const again = screen.getByRole("region", { name: c.title });
    expect(within(again).queryByText(/Порог не достигнут/)).toBeNull();
    expect(within(again).getByRole("button", { name: "Проверить ответы" })).toBeTruthy();
  });
});
