// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OpenApiTrainerView from "../../src/features/openapi/OpenApiTrainerView";

beforeEach(() => cleanup());

const input = () => screen.getByLabelText("Спецификация (YAML)") as HTMLTextAreaElement;

describe("тренажёр OpenAPI", () => {
  it("корректный пример: «Замечаний нет» и число путей и операций", async () => {
    render(<OpenApiTrainerView />);
    expect(await screen.findByText("Замечаний нет.")).toBeTruthy();
    expect(screen.getByText(/Найдено путей: 2, операций: 2/)).toBeTruthy();
  });

  it("«Пример с ошибками» показывает замечания с местом и источником; «Корректный пример» возвращает чистый результат", async () => {
    render(<OpenApiTrainerView />);
    await userEvent.click(screen.getByRole("button", { name: "Пример с ошибками" }));
    expect(await screen.findByText(/Замечаний: \d+\./)).toBeTruthy();
    expect(screen.getByText(/Версия 3\.0\.3 не подходит/)).toBeTruthy();
    expect(screen.getAllByText(/Источник: OpenAPI 3\.1\.1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Где: paths\./).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Корректный пример" }));
    expect(await screen.findByText("Замечаний нет.")).toBeTruthy();
  });

  it("после паузы в вводе правила применяются к тексту; YAML с ошибкой показывает строку и не проверяет правила", async () => {
    render(<OpenApiTrainerView />);
    await userEvent.clear(input());
    await userEvent.click(input());
    await userEvent.paste("openapi: 3.1.1\ninfo:\n  title: [Тест\n  version: 1\n");
    expect(await screen.findByText(/Правила не проверены: сначала исправьте YAML/)).toBeTruthy();
    expect(screen.getByText(/Строка \d+:/)).toBeTruthy();
    expect(screen.queryByText("Замечаний нет.")).toBeNull();
  });

  it("пустое поле: подсказка вместо замечаний", async () => {
    render(<OpenApiTrainerView />);
    await userEvent.clear(input());
    expect(await screen.findByText("Вставьте спецификацию, чтобы увидеть замечания.")).toBeTruthy();
  });
});
