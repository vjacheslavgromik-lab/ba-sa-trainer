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
  window.location.hash = "#/modules/5/cases";
});

async function passGate(caseId: string) {
  const c = getCases("5").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const qid of c.questions) {
    const q = getQuestion(qid)!;
    await userEvent.click(within(within(card).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[q.correct]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

describe("страница кейсов модуля 5", () => {
  it("вкладка кейсов доступна, четыре карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("5")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("эталон кейса 1 показан блоком кода BPMN после отправки ответа", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M5-CASE-01");
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Пул «Пациент»");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    const pre = card.querySelector("pre");
    expect(pre?.textContent).toContain("Пул «Клиника»");
    expect(pre?.textContent).toContain("<X:");
  });

  it("эталон кейса 4 содержит два блока кода: контекст и уровень 0", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M5-CASE-04");
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Пациент --Заявка на оплату--> 0");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(card.querySelectorAll("pre")).toHaveLength(2);
  });
});
