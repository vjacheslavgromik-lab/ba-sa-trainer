// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import App from "../../src/app/App";
import { MODULES, PUBLISHED_WAVES, MODULES_WITH_TRAINER, findModule, isModulePublished } from "../../src/data/modules";

// jsdom не реализует ResizeObserver; Radix его использует.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

beforeEach(() => {
  cleanup();
  window.location.hash = "#/";
});

const tab = (nav: HTMLElement, start: string) =>
  within(nav).getAllByRole("link").find((l) => l.textContent?.includes(start)) as HTMLElement;

describe("Волны контента (US-8.5)", () => {
  it("опубликована волна 1: модули 2, 3, 9 доступны, остальные в разработке", () => {
    expect(PUBLISHED_WAVES).toEqual([1]);
    const published = MODULES.filter((m) => isModulePublished(m)).map((m) => m.id);
    expect(published).toEqual(["2", "3", "9"]);
  });

  it("при публикации волны 2 модули волны 2 становятся доступными", () => {
    const wave2 = MODULES.filter((m) => m.wave === 2);
    expect(wave2.length).toBeGreaterThan(0);
    for (const m of wave2) {
      expect(isModulePublished(m)).toBe(false);
      expect(isModulePublished(m, [1, 2])).toBe(true);
    }
  });

  it("на странице модулей у каждой карточки есть волна и статус доступности", async () => {
    window.location.hash = "#/modules";
    render(<App />);
    const list = await screen.findByRole("list");
    const cards = within(list).getAllByRole("link");
    expect(cards).toHaveLength(14);
    expect(within(list).getAllByText("Доступен")).toHaveLength(3);
    expect(within(list).getAllByText("В разработке")).toHaveLength(11);
    for (const m of MODULES) {
      const card = cards.find((c) => c.textContent?.includes(m.title)) as HTMLElement;
      expect(card.textContent).toContain(`Волна ${m.wave}`);
    }
  });
});

describe("Статус «В разработке» (US-8.4)", () => {
  it("модуль без контента: все разделы помечены, теория показывает пометку", async () => {
    window.location.hash = "#/modules/10";
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Разделы модуля" });
    for (const name of ["Теория", "Кейсы", "Тренажёры"]) {
      expect(tab(nav, name).textContent).toContain("В разработке");
    }
    expect(screen.getByText(/Теория для этого модуля появятся/)).toBeTruthy();
    expect(screen.getByText("Модуль в разработке")).toBeTruthy();
  });

  it("модуль 2: теория и кейсы доступны, тренажёры в разработке", async () => {
    window.location.hash = "#/modules/2";
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Разделы модуля" });
    expect(tab(nav, "Теория").textContent).not.toContain("В разработке");
    expect(tab(nav, "Кейсы").textContent).not.toContain("В разработке");
    expect(tab(nav, "Тренажёры").textContent).toContain("В разработке");
    expect(screen.queryByText("Модуль в разработке")).toBeNull();
  });

  it("модуль 9: теория, кейсы и тренажёр доступны", async () => {
    window.location.hash = "#/modules/9";
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Разделы модуля" });
    expect(tab(nav, "Теория").textContent).not.toContain("В разработке");
    expect(tab(nav, "Тренажёры").textContent).not.toContain("В разработке");
    expect(tab(nav, "Кейсы").textContent).not.toContain("В разработке");
  });

  it("модуль 4 из волны 2: теория, кейсы и тренажёр ER доступны", async () => {
    expect(MODULES_WITH_TRAINER).toContain("4");
    expect(findModule("4")?.wave).toBe(2);
    window.location.hash = "#/modules/4";
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Разделы модуля" });
    expect(tab(nav, "Тренажёры").textContent).not.toContain("В разработке");
    expect(tab(nav, "Теория").textContent).not.toContain("В разработке");
    expect(tab(nav, "Кейсы").textContent).not.toContain("В разработке");
  });

  it("вкладка «Кейсы» модуля без кейсов объясняет, что раздел в разработке", async () => {
    window.location.hash = "#/modules/10/cases";
    render(<App />);
    expect(await screen.findByText(/Кейсы для этого модуля появятся/)).toBeTruthy();
  });
});
