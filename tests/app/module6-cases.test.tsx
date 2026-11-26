// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/app/App";
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
  window.location.hash = "#/modules/6/cases";
});

async function passGate(caseId: string) {
  const c = getCases("6").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const qid of c.questions) {
    const q = getQuestion(qid)!;
    await userEvent.click(within(within(card).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[q.correct]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

describe("страница кейсов модуля 6", () => {
  it("вкладка кейсов доступна, четыре карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("6")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("условие кейса 1 — список из трёх групп исследования, эталон — блок кода с тремя персонами", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M6-CASE-01");
    expect(within(card).getAllByRole("listitem").filter((li) => /пациенты|родители/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(3);
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Персона 1. Анна");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(card.querySelector("pre")?.textContent).toContain("Персона 3. Мария");
  });

  it("эталон кейса 3 показан двумя блоками кода: карта сайта и карта диалогов", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M6-CASE-03");
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Личный кабинет");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(card.querySelectorAll("pre")).toHaveLength(2);
  });
});
