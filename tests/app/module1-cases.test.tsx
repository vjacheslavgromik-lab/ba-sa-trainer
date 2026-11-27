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
  window.location.hash = "#/modules/1/cases";
});

async function passGate(caseId: string) {
  const c = getCases("1").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const qid of c.questions) {
    const q = getQuestion(qid)!;
    await userEvent.click(within(within(card).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[q.correct]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

describe("страница кейсов модуля 1", () => {
  it("вкладка кейсов доступна, четыре карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("1")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("условие кейса 1 — список из десяти задач, эталон — блок кода после отправки ответа", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M1-CASE-01");
    expect(within(card).getAllByRole("listitem").filter((li) => /кодa?|код записи|метрику успеха|интеграцию с платёжным шлюзом/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(3);
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("1) Бизнес-цель — владелец продукта");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    const pre = card.querySelector("pre");
    expect(pre?.textContent).toContain("системный аналитик");
  });

  it("эталон кейса 2 показан блоком кода с распределением по подсистемам", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M1-CASE-02");
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Ф1. Система показывает свободные окна");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(card.querySelector("pre")?.textContent).toContain("Распределение по подсистемам");
  });
});
