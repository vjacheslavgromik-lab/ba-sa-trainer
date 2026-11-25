// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgressPage from "../../src/features/progress/ProgressPage";
import { SCHEMA_VERSION, loadProgress, saveProgress, type Progress } from "../../src/features/progress/progress";

const stored: Progress = { schemaVersion: SCHEMA_VERSION, cases: { "M2-CASE-01": { answers: { "M2-Q01": 0 } } } };
const fileProgress: Progress = {
  schemaVersion: SCHEMA_VERSION,
  cases: {
    "M3-CASE-01": { answers: { "M3-Q02": 2 }, practice: { answer: "SELECT 1", submitted: true } },
    "M3-CASE-02": { answers: {} },
  },
};

function jsonFile(content: unknown, name = "progress.json"): File {
  return new File([typeof content === "string" ? content : JSON.stringify(content)], name, { type: "application/json" });
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  saveProgress(stored);
});

describe("экран «Прогресс» (US-7.2–7.4)", () => {
  it("показывает предупреждение о хранении в браузере", () => {
    render(<ProgressPage />);
    expect(screen.getByRole("note").textContent).toContain("хранится только в этом браузере");
  });

  it("экспорт скачивает JSON с версией схемы", async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      blob = b as Blob;
      return "blob:test";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ProgressPage />);
    await userEvent.click(screen.getByRole("button", { name: "Экспорт прогресса" }));
    expect(click).toHaveBeenCalledTimes(1);
    const data = JSON.parse(await blob!.text());
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(data.cases["M2-CASE-01"].answers).toEqual({ "M2-Q01": 0 });
    click.mockRestore();
  });

  it("повреждённый файл даёт ошибку и не меняет данные", async () => {
    render(<ProgressPage />);
    await userEvent.upload(screen.getByLabelText("Импорт прогресса (файл JSON)"), jsonFile("{сломано"));
    expect(await screen.findByText(/Файл повреждён.*Данные не изменены/)).toBeTruthy();
    expect(loadProgress()).toEqual(stored);
    expect(screen.queryByRole("button", { name: "Подтвердить импорт" })).toBeNull();
  });

  it("файл с другой версией схемы отклоняется", async () => {
    render(<ProgressPage />);
    await userEvent.upload(screen.getByLabelText("Импорт прогресса (файл JSON)"), jsonFile({ schemaVersion: 7, cases: {} }));
    expect(await screen.findByText(/не поддерживается/)).toBeTruthy();
    expect(loadProgress()).toEqual(stored);
  });

  it("верный файл: предпросмотр, данные не меняются до подтверждения, затем восстанавливаются", async () => {
    render(<ProgressPage />);
    await userEvent.upload(screen.getByLabelText("Импорт прогресса (файл JSON)"), jsonFile(fileProgress));
    expect(await screen.findByRole("group", { name: "Предпросмотр импорта" })).toBeTruthy();
    expect(loadProgress()).toEqual(stored);
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить импорт" }));
    await waitFor(() => expect(loadProgress()).toEqual(fileProgress));
    expect(screen.queryByRole("group", { name: "Предпросмотр импорта" })).toBeNull();
    expect(await screen.findByText("Прогресс восстановлен из файла.")).toBeTruthy();
  });

  it("отмена предпросмотра оставляет данные как были", async () => {
    render(<ProgressPage />);
    await userEvent.upload(screen.getByLabelText("Импорт прогресса (файл JSON)"), jsonFile(fileProgress));
    await userEvent.click(await screen.findByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("group", { name: "Предпросмотр импорта" })).toBeNull();
    expect(loadProgress()).toEqual(stored);
  });
});
