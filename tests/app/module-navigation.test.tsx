// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/app/App";
import { MODULES, moduleLabel, neighbours } from "../../src/data/modules";

if (!("ResizeObserver" in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

beforeEach(() => {
  cleanup();
});

async function open(hash: string) {
  window.location.hash = hash;
  render(<App />);
  return screen.findByRole("heading", { level: 1 });
}

describe("Кнопки «Назад» и «Вперёд» между модулями", () => {
  it("соседи определяются по порядку списка: у первого нет предыдущего, у последнего нет следующего", () => {
    expect(neighbours("0").prev).toBeUndefined();
    expect(neighbours("0").next?.id).toBe("1");
    expect(neighbours("12").next?.id).toBe("final");
    expect(neighbours("final").next).toBeUndefined();
    expect(neighbours("final").prev?.id).toBe("12");
    expect(neighbours("нет такого")).toEqual({});
    for (let i = 1; i < MODULES.length - 1; i++) {
      expect(neighbours(MODULES[i].id).prev?.id).toBe(MODULES[i - 1].id);
      expect(neighbours(MODULES[i].id).next?.id).toBe(MODULES[i + 1].id);
    }
  });

  it("у выпускного проекта в подписи нет номера", () => {
    expect(moduleLabel(MODULES[MODULES.length - 1])).toBe("Выпускной проект");
    expect(moduleLabel(MODULES[3])).toBe("Модуль 3. SQL для аналитиков");
  });

  it("на странице модуля две области навигации (вверху и внизу) с ссылками на соседние модули", async () => {
    await open("#/modules/3/theory");
    expect(screen.getByRole("navigation", { name: "Переход между модулями вверху страницы" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Переход между модулями внизу страницы" })).toBeTruthy();
    const back = screen.getAllByRole("link", { name: "Назад: Модуль 2. Разработка требований" });
    const forward = screen.getAllByRole("link", { name: "Вперёд: Модуль 4. Моделирование данных" });
    expect(back).toHaveLength(2);
    expect(forward).toHaveLength(2);
    expect(back[0].getAttribute("href")).toBe("#/modules/2/theory");
    expect(forward[0].getAttribute("href")).toBe("#/modules/4/theory");
  });

  it("«Вперёд» открывает следующий модуль", async () => {
    await open("#/modules/3/theory");
    await userEvent.click(screen.getAllByRole("link", { name: /Вперёд: Модуль 4/ })[1]);
    expect(await screen.findByRole("heading", { level: 1, name: "Моделирование данных" })).toBeTruthy();
    expect(window.location.hash).toBe("#/modules/4/theory");
  });

  it("«Назад» открывает предыдущий модуль", async () => {
    await open("#/modules/3/theory");
    await userEvent.click(screen.getAllByRole("link", { name: /Назад: Модуль 2/ })[0]);
    expect(await screen.findByRole("heading", { level: 1, name: "Разработка требований" })).toBeTruthy();
  });

  it("при переходе сохраняется вкладка: на «Кейсах» ссылки ведут на «Кейсы» соседних модулей", async () => {
    await open("#/modules/5/cases");
    const forward = screen.getAllByRole("link", { name: /Вперёд: Модуль 6/ });
    expect(forward[0].getAttribute("href")).toBe("#/modules/6/cases");
    expect(screen.getAllByRole("link", { name: /Назад: Модуль 4/ })[0].getAttribute("href")).toBe("#/modules/4/cases");
  });

  it("у модуля 0 нет «Назад», у выпускного проекта нет «Вперёд»", async () => {
    await open("#/modules/0/theory");
    expect(screen.queryAllByRole("link", { name: /Назад:/ })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: /Вперёд: Модуль 1/ })).toHaveLength(2);
    cleanup();
    await open("#/modules/final/theory");
    expect(screen.queryAllByRole("link", { name: /Вперёд:/ })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Назад: Модуль 12. Расширенная архитектура" })).toHaveLength(2);
  });

  it("на странице несуществующего модуля кнопок нет", async () => {
    window.location.hash = "#/modules/nope/theory";
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Модуль не найден" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: /Переход между модулями/ })).toBeNull();
  });
});
