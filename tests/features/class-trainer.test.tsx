// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const renderClass = vi.fn();
vi.mock("../../src/features/classdiagram/renderClass", () => ({ renderClass: (s: string) => renderClass(s) }));
import ClassTrainerView from "../../src/features/classdiagram/ClassTrainerView";

beforeEach(() => {
  cleanup();
  renderClass.mockReset();
  renderClass.mockResolvedValue({ ok: true, svg: "<svg><title>график</title></svg>" });
});

const input = () => screen.getByLabelText("Диаграмма (Mermaid)") as HTMLTextAreaElement;

describe("тренажёр диаграммы классов", () => {
  it("строит предпросмотр и показывает «Замечаний нет» для корректного примера", async () => {
    render(<ClassTrainerView />);
    expect(await screen.findByRole("img", { name: "График диаграммы классов" })).toBeTruthy();
    expect(screen.getByText("Замечаний нет.")).toBeTruthy();
  });

  it("«Пример с ошибками» показывает замечания с источниками, «Корректный пример» возвращает чистый результат", async () => {
    render(<ClassTrainerView />);
    await userEvent.click(screen.getByRole("button", { name: "Пример с ошибками" }));
    expect(input().value).toContain("class Warehouse");
    expect((await screen.findAllByText(/не указана кратность/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Источник: Вендров/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Корректный пример" }));
    expect(await screen.findByText("Замечаний нет.")).toBeTruthy();
  });

  it("синтаксическая ошибка: показана строка, правила не проверяются, ошибка Mermaid показана отдельно", async () => {
    renderClass.mockResolvedValue({ ok: false, message: "Parse error on line 2" });
    render(<ClassTrainerView />);
    await userEvent.clear(input());
    await userEvent.click(input());
    await userEvent.paste("classDiagram\n  непонятно что\n");
    expect(await screen.findByText(/Правила не проверены: сначала исправьте синтаксис/)).toBeTruthy();
    expect(await screen.findByText(/Строка 2:/)).toBeTruthy();
    expect(await screen.findByText(/Ошибка в диаграмме: Parse error on line 2/)).toBeTruthy();
  });

  it("пустое поле: подсказка вместо графика", async () => {
    render(<ClassTrainerView />);
    await userEvent.clear(input());
    expect(await screen.findByText("Введите диаграмму, чтобы увидеть график.")).toBeTruthy();
  });
});
