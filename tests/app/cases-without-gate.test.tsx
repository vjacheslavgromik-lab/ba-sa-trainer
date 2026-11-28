// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Подменяем загрузчик: для модуля 2 возвращается кейс без вопросов (gate: none), для остальных — настоящие данные.
const noGateCase = {
  id: "TEST-NOGATE",
  module: 2,
  title: "Этап без вопросов",
  condition: "Опишите **требования** заказчика.",
  checklist: ["Есть цель", "Есть границы", "Есть критерии", "Есть риски"],
  reference: "Эталон этапа",
  check: { type: "manual" },
  gate: "none" as const,
  questions: [] as string[],
};
vi.mock("../../src/content/loader", async () => {
  const actual = await vi.importActual<typeof import("../../src/content/loader")>("../../src/content/loader");
  return { ...actual, getCases: (id: string) => (id === "2" ? [noGateCase] : actual.getCases(id)) };
});

import App from "../../src/app/App";

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
  window.location.hash = "#/modules/2/cases";
});

describe("кейс без вопросов (gate: none)", () => {
  it("шаг «Теория» не показывается, практика и условие открыты сразу", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { level: 3, name: "Практика: «Этап без вопросов»" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3, name: "Теория" })).toBeNull();
    expect(screen.queryByText(/Порог пройден/)).toBeNull();
    expect(screen.queryByText(/Кейс откроется после/)).toBeNull();
    expect(screen.getByText("требования")).toBeTruthy();
    expect(screen.getByLabelText("Ваш ответ")).toBeTruthy();
  });

  it("после ответа показан чек-лист и эталон; засчёт — по порогу 75% чек-листа", async () => {
    render(<App />);
    const card = await screen.findByRole("region", { name: "Этап без вопросов" });
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Мой ответ");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(within(card).getByText("Эталон этапа")).toBeTruthy();
    expect(within(card).getByText(/Кейс не засчитан/)).toBeTruthy();
    for (const item of ["Есть цель", "Есть границы", "Есть критерии"]) await userEvent.click(within(card).getByLabelText(item));
    expect(within(card).getByText(/Кейс засчитан/)).toBeTruthy();
  });

  it("обычные кейсы других модулей по-прежнему закрыты вопросами теории", async () => {
    window.location.hash = "#/modules/4/cases";
    render(<App />);
    expect((await screen.findAllByRole("heading", { level: 3, name: "Теория" })).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Кейс откроется после прохождения проверки теории/).length).toBeGreaterThan(0);
  });
});
