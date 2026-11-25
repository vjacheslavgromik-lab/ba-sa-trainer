// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SqlCasePractice from "../../src/features/sql/SqlCasePractice";
import type { CaseData } from "../../src/content/loader";

const checkSqlAnswer = vi.fn();
vi.mock("../../src/features/sql/runSqlCheck", () => ({
  checkSqlAnswer: (input: unknown) => checkSqlAnswer(input),
}));

const data: CaseData = {
  id: "M3-CASE-01",
  module: 3,
  title: "Студенты из Москвы",
  condition: "Выведите имена студентов из Москвы.",
  checklist: ["Выбран столбец name"],
  reference: "Эталон: SELECT name FROM students WHERE city = 'Москва' ORDER BY name;",
  check: { type: "sql" },
  sql: { setup: "CREATE TABLE t(a);", referenceQuery: "SELECT 1", ordered: true },
  questions: ["M3-Q01"],
};

beforeEach(() => {
  cleanup();
  checkSqlAnswer.mockReset();
});

describe("практика SQL-кейса (US-8.2)", () => {
  it("кнопка проверки заблокирована, пока запрос пуст", () => {
    render(<SqlCasePractice data={data} initialQuery="" solved={false} onSolved={() => {}} />);
    expect((screen.getByRole("button", { name: "Проверить запрос" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("передаёт в проверку скрипт, эталон, запрос и флаг порядка; верный ответ засчитывается", async () => {
    checkSqlAnswer.mockResolvedValue({ ok: true, message: "совпало" });
    const onSolved = vi.fn();
    render(<SqlCasePractice data={data} initialQuery="" solved={false} onSolved={onSolved} />);
    await userEvent.type(screen.getByLabelText("Ваш запрос"), "SELECT 1");
    await userEvent.click(screen.getByRole("button", { name: "Проверить запрос" }));
    await waitFor(() => expect(onSolved).toHaveBeenCalledWith("SELECT 1"));
    expect(checkSqlAnswer).toHaveBeenCalledWith({
      setup: "CREATE TABLE t(a);",
      referenceQuery: "SELECT 1",
      userQuery: "SELECT 1",
      ordered: true,
    });
    expect(await screen.findByText("Результат совпал с эталоном.")).toBeTruthy();
  });

  it("неверный ответ показывает причину и не засчитывается", async () => {
    checkSqlAnswer.mockResolvedValue({ ok: false, message: "не совпало: строк в результате 1, в эталоне 2" });
    const onSolved = vi.fn();
    render(<SqlCasePractice data={data} initialQuery="" solved={false} onSolved={onSolved} />);
    await userEvent.type(screen.getByLabelText("Ваш запрос"), "SELECT 2");
    await userEvent.click(screen.getByRole("button", { name: "Проверить запрос" }));
    expect(await screen.findByText(/строк в результате 1, в эталоне 2/)).toBeTruthy();
    expect(onSolved).not.toHaveBeenCalled();
    expect(screen.queryByText("Кейс засчитан.")).toBeNull();
  });

  it("сбой проверки показывает ошибку, а не падает", async () => {
    checkSqlAnswer.mockRejectedValue(new Error("движок недоступен"));
    render(<SqlCasePractice data={data} initialQuery="SELECT 1" solved={false} onSolved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Проверить запрос" }));
    expect(await screen.findByText(/движок недоступен/)).toBeTruthy();
  });

  it("решённый кейс показывает эталон и блокирует ввод", () => {
    render(<SqlCasePractice data={data} initialQuery="SELECT 1" solved onSolved={() => {}} />);
    expect((screen.getByLabelText("Ваш запрос") as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByText("Кейс засчитан.")).toBeTruthy();
    expect(screen.getByText(/ORDER BY name/)).toBeTruthy();
  });
});
