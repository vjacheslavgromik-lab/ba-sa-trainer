// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/app/App";
import { getCases, getQuestion } from "../../src/content/loader";

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
  window.location.hash = "#/modules/11/cases";
});

async function passGate(caseId: string) {
  const c = getCases("11").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const qid of c.questions) {
    const q = getQuestion(qid)!;
    await userEvent.click(within(within(card).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[q.correct]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

describe("страница кейсов модуля 11", () => {
  it("вкладка кейсов доступна, четыре карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("11")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("условие кейса 2 — список обращений, эталон — блок кода с FAQ", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M11-CASE-02");
    expect(within(card).getAllByRole("listitem").filter((li) => /Не пришло подтверждение/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(1);
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Руководство регистратора");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(card.querySelector("pre")?.textContent).toContain("FAQ (пять самых частых обращений)");
  });

  it("эталон кейса 1 показан блоком кода с таблицей требований ПМИ", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M11-CASE-01");
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("ПМИ: объект — онлайн-запись");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    const pre = card.querySelector("pre")?.textContent ?? "";
    expect(pre).toContain("ТР-УВ-1");
    expect(pre).toContain("не выполнено");
  });
});
