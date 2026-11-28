// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import App from "../../src/app/App";
import { MODULES_WITH_TRAINER } from "../../src/data/modules";

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

describe("вкладка «Тренажёры»: OpenAPI", () => {
  it("тренажёры есть у модулей 3, 4, 9, 12 и выпускного проекта", () => {
    expect([...MODULES_WITH_TRAINER].sort()).toEqual(["12", "3", "4", "9", "final"]);
  });

  it("модуль 9: Postman и OpenAPI рядом", async () => {
    window.location.hash = "#/modules/9/trainers";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Тренажёр OpenAPI" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Тренажёр Postman" })).toBeTruthy();
  });

  it("модуль 12 и выпускной проект: тренажёр OpenAPI", async () => {
    window.location.hash = "#/modules/12/trainers";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Тренажёр OpenAPI" })).toBeTruthy();
    cleanup();
    window.location.hash = "#/modules/final/trainers";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Тренажёр OpenAPI" })).toBeTruthy();
    const tabs = screen.getAllByRole("link").filter((l) => l.textContent?.startsWith("Тренажёры"));
    expect(tabs[0].textContent).not.toContain("В разработке");
  });

  it("модули без тренажёра по-прежнему показывают «В разработке»", async () => {
    window.location.hash = "#/modules/7/trainers";
    render(<App />);
    expect(await screen.findByText(/Тренажёры для этого модуля появятся/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Тренажёр OpenAPI" })).toBeNull();
  });
});
