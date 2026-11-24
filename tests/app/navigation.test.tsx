// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/app/App";
import { MODULES } from "../../src/data/modules";
import { ProgressBar } from "../../src/shared/ui/ProgressBar";

beforeEach(() => {
  cleanup();
  window.location.hash = "#/";
});

describe("Список модулей (US-1.1)", () => {
  it("показывает все 14 модулей со статусом «Не начат»", async () => {
    window.location.hash = "#/modules";
    render(<App />);
    const list = await screen.findByRole("list");
    const cards = within(list).getAllByRole("link");
    expect(cards).toHaveLength(MODULES.length);
    expect(MODULES).toHaveLength(14);
    expect(screen.getAllByText("Не начат")).toHaveLength(14);
  });

  it("отмечает модули среза (2, 3, 9)", () => {
    const slice = MODULES.filter((m) => m.slice).map((m) => m.id);
    expect(slice).toEqual(["2", "3", "9"]);
  });
});

describe("Свободный выбор модуля (US-1.2)", () => {
  it("открывает модуль 9 напрямую, без прохождения предыдущих", async () => {
    window.location.hash = "#/modules/9";
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Программные интерфейсы (API)" })).toBeTruthy();
  });

  it("показывает понятное сообщение для неизвестного модуля", async () => {
    window.location.hash = "#/modules/99";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Модуль не найден" })).toBeTruthy();
  });
});

describe("Вкладки модуля (US-1.3)", () => {
  it("переключает разделы и отмечает активную вкладку", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/modules/2";
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Разделы модуля" });
    expect(within(nav).getByRole("link", { name: "Теория" }).getAttribute("aria-current")).toBe("page");
    await user.click(within(nav).getByRole("link", { name: "Кейсы" }));
    expect(within(nav).getByRole("link", { name: "Кейсы" }).getAttribute("aria-current")).toBe("page");
    expect(window.location.hash).toBe("#/modules/2/cases");
  });
});

describe("Компонент прогресса (T-1.4)", () => {
  it("передаёт значения доступности", () => {
    render(<ProgressBar value={3} max={25} label="Выполнено кейсов" />);
    const bar = screen.getByRole("progressbar", { name: "Выполнено кейсов" });
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("25");
    expect(screen.getByText("3 из 25")).toBeTruthy();
  });
});
