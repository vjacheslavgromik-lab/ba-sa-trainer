// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const renderEr = vi.fn();
vi.mock("../../src/features/er/renderEr", () => ({ renderEr: (s: string) => renderEr(s) }));
import ErTrainerView from "../../src/features/er/ErTrainerView";

beforeEach(() => {
  cleanup();
  renderEr.mockReset();
  renderEr.mockResolvedValue({ ok: true, svg: "<svg><title>график</title></svg>" });
});
afterEach(() => vi.useRealTimers());

const input = () => screen.getByLabelText("Диаграмма (Mermaid)") as HTMLTextAreaElement;

describe("тренажёр ER (US-6.3)", () => {
  it("строит предпросмотр и показывает «Замечаний нет» для корректной диаграммы", async () => {
    render(<ErTrainerView />);
    expect(await screen.findByRole("img", { name: "График ER-диаграммы" })).toBeTruthy();
    expect(screen.getByText("Замечаний нет.")).toBeTruthy();
  });

  it("обновляет предпросмотр только после паузы в 500 мс", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ErTrainerView />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    renderEr.mockClear();
    await user.type(input(), "\n%% x");
    expect(renderEr).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(renderEr).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(renderEr).toHaveBeenCalledTimes(1);
    expect(renderEr.mock.calls[0][0]).toContain("%% x");
  });

  it("при ошибке показывает сообщение, а прошлый график остаётся", async () => {
    render(<ErTrainerView />);
    await screen.findByRole("img", { name: "График ER-диаграммы" });
    renderEr.mockResolvedValue({ ok: false, message: "Parse error on line 2" });
    await userEvent.type(input(), " ");
    expect(await screen.findByText(/Parse error on line 2/, undefined, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByRole("img", { name: "График ER-диаграммы" })).toBeTruthy();
  });

  it("показывает замечание «нет первичного ключа» с сущностью", async () => {
    render(<ErTrainerView />);
    await screen.findByRole("img", { name: "График ER-диаграммы" });
    const area = input();
    await userEvent.clear(area);
    await userEvent.type(area, "erDiagram{enter}A {{{enter}int id{enter}}");
    expect(await screen.findByText(/В сущности «A» нет первичного ключа/, undefined, { timeout: 2000 })).toBeTruthy();
  });

  it("пустое поле: подсказка, без запроса к Mermaid", async () => {
    render(<ErTrainerView />);
    await screen.findByRole("img", { name: "График ER-диаграммы" });
    renderEr.mockClear();
    await userEvent.clear(input());
    expect(await screen.findByText("Введите диаграмму, чтобы увидеть график.", undefined, { timeout: 2000 })).toBeTruthy();
    expect(renderEr).not.toHaveBeenCalled();
  });
});
