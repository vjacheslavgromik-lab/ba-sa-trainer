// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Для модуля 2 загрузка теории «падает» (имитация обрыва сети), для остальных работает настоящая.
vi.mock("../../src/content/loader", async () => {
  const actual = await vi.importActual<typeof import("../../src/content/loader")>("../../src/content/loader");
  return {
    ...actual,
    loadTheoryParts: (id: string) => (id === "2" ? Promise.reject(new Error("сеть")) : actual.loadTheoryParts(id)),
  };
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
});

describe("страница теории при ленивой загрузке", () => {
  it("сначала показывает «Загрузка теории…», затем содержание и главы", async () => {
    window.location.hash = "#/modules/4/theory";
    render(<App />);
    expect(screen.getByRole("status").textContent).toContain("Загрузка теории");
    expect(await screen.findByRole("navigation", { name: "Содержание" })).toBeTruthy();
    expect(screen.queryByText("Загрузка теории…")).toBeNull();
    expect(screen.getByRole("heading", { name: /Глава 1\. Модели данных/ })).toBeTruthy();
  });

  it("при переходе к другому модулю показывается теория нового модуля, а не прежнего", async () => {
    window.location.hash = "#/modules/4/theory";
    render(<App />);
    await screen.findByRole("navigation", { name: "Содержание" });
    await userEvent.click(screen.getAllByRole("link", { name: /Вперёд: Модуль 5/ })[0]);
    expect(await screen.findByRole("heading", { name: /Глава 1\. Виды и уровни моделей процессов/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Глава 1\. Модели данных/ })).toBeNull();
  });

  it("если файл теории не загрузился, показано сообщение об ошибке", async () => {
    window.location.hash = "#/modules/2/theory";
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Не удалось загрузить теорию");
  });

  it("вкладки «Кейсы» и «Тренажёры» не загружают теорию и работают как прежде", async () => {
    window.location.hash = "#/modules/2/cases";
    render(<App />);
    expect((await screen.findAllByRole("heading", { level: 3, name: "Теория" })).length).toBeGreaterThan(0);
    expect(screen.queryByText("Загрузка теории…")).toBeNull();
  });
});
