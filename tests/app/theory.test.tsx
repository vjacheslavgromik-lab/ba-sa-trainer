// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/app/App";
import { getTheoryParts } from "../helpers/theory";

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

describe("Порядок и содержание теории модуля 9", () => {
  const parts = getTheoryParts("9");

  it("главы идут по порядку файлов, и первая — определение программного интерфейса", () => {
    expect(parts).toHaveLength(11);
    expect(parts[0].title).toBe("Что такое программный интерфейс");
    expect(parts.map((p) => p.title).slice(-1)[0]).toBe("Словарь терминов");
    expect(parts[7].title).toBe("Документирование API: спецификации и другие артефакты");
    expect(parts[0].body).toContain("**Определение");
    expect(parts[0].body).toContain("API");
  });

  it("в тексте нет сырых таблиц, склеенных в одну строку", () => {
    for (const p of parts) {
      for (const line of p.body.split("\n")) {
        if (line.startsWith("|")) {
          expect(line.endsWith("|")).toBe(true);
          expect(line.match(/\|\s*\|---/)).toBeNull();
        }
      }
    }
  });
});

describe("Отображение теории", () => {
  it("многоглавная теория: содержание, заголовки глав и таблицы отрисованы", async () => {
    window.location.hash = "#/modules/9/theory";
    render(<App />);
    const toc = await screen.findByRole("navigation", { name: "Содержание" });
    expect(within(toc).getAllByRole("button")).toHaveLength(11);
    expect(screen.getByRole("heading", { level: 2, name: "Глава 1. Что такое программный интерфейс" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Глава 10. Диаграмма последовательности" })).toBeTruthy();
    // Заголовки внутри глав сдвинуты на уровень вниз: это h3, а не h2.
    expect(screen.getByRole("heading", { level: 3, name: "Пример из жизни: меню в ресторане" })).toBeTruthy();
    // Таблицы Markdown отображаются таблицами.
    const methods = screen.getAllByRole("table").find((t) => within(t).queryByText("Типичный успешный ответ"));
    expect(methods).toBeTruthy();
    expect(within(methods as HTMLElement).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(methods as HTMLElement).getAllByRole("row")).toHaveLength(5);
    expect(document.body.textContent).not.toContain("|---|");
  });

  it("кнопка содержания прокручивает к главе и не меняет маршрут", async () => {
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    window.location.hash = "#/modules/9/theory";
    render(<App />);
    const toc = await screen.findByRole("navigation", { name: "Содержание" });
    await userEvent.click(within(toc).getByRole("button", { name: "Проверка API в Postman" }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#/modules/9/theory");
  });

  it("блок-документ в теории: подпись с именем файла и кнопка скачивания отдаёт текст документа", async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      blob = b as Blob;
      return "blob:test";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    window.location.hash = "#/modules/9/theory";
    render(<App />);
    const button = await screen.findByRole("button", { name: "Скачать school-api.openapi.yaml" });
    expect(screen.getByRole("button", { name: "Скачать school.wsdl" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("file=school-api.openapi.yaml");
    await userEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
    const text = await blob!.text();
    expect(text.startsWith("openapi: 3.1.1")).toBe(true);
    expect(text.endsWith("\n")).toBe(true);
    expect(blob!.type).toBe("application/yaml");
    click.mockRestore();
  });

  it("обычные блоки кода без file= выводятся без кнопки скачивания", async () => {
    window.location.hash = "#/modules/9/theory";
    render(<App />);
    await screen.findByRole("button", { name: "Скачать school-api.openapi.yaml" });
    expect(screen.getAllByRole("button", { name: /^Скачать / })).toHaveLength(2);
  });

  it("теория с одной главой (модуль 2) отображается без содержания, как раньше", async () => {
    window.location.hash = "#/modules/2/theory";
    render(<App />);
    expect(await screen.findByRole("heading", { level: 2, name: "1. Что такое требование" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Содержание" })).toBeNull();
  });

  it("теория модуля 3: две главы в нужном порядке, таблицы SQL-примеров не ломаются", async () => {
    const titles = getTheoryParts("3").map((p) => p.title);
    expect(titles).toEqual(["Реляционная модель и простые запросы SQL", "Соединения, агрегаты и группировка"]);
  });
});
