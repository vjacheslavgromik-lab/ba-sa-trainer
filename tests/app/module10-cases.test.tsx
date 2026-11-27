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
  window.location.hash = "#/modules/10/cases";
});

async function passGate(caseId: string) {
  const c = getCases("10").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const qid of c.questions) {
    const q = getQuestion(qid)!;
    await userEvent.click(within(within(card).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[q.correct]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

describe("страница кейсов модуля 10", () => {
  it("вкладка кейсов доступна, четыре карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("10")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("эталон кейса 2 показан блоком кода с тест-кейсами, среди них непройденный граничный", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M10-CASE-02");
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("ТК-ОТМ-01 | позитивный | Отмена за 5 часов");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    const pre = card.querySelector("pre")?.textContent ?? "";
    expect(pre).toContain("ТК-ОТМ-03");
    expect(pre).toContain("не пройден");
  });

  it("эталон кейса 4 показан блоком кода с шагами конвейера", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M10-CASE-04");
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("1. Запуск");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(card.querySelector("pre")?.textContent).toContain("Выпуск в продуктив");
  });
});
