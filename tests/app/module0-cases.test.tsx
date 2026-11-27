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
  window.location.hash = "#/modules/0/cases";
});

async function passGate(caseId: string) {
  const c = getCases("0").find((x) => x.id === caseId)!;
  const card = screen.getByRole("region", { name: c.title });
  for (const qid of c.questions) {
    const q = getQuestion(qid)!;
    await userEvent.click(within(within(card).getByRole("radiogroup", { name: q.prompt })).getByLabelText(q.options[q.correct]));
  }
  await userEvent.click(within(card).getByRole("button", { name: "Проверить ответы" }));
  return card;
}

async function submit(card: HTMLElement, text: string) {
  await userEvent.click(within(card).getByLabelText("Ваш ответ"));
  await userEvent.paste(text);
  await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
}

describe("страница кейсов модуля 0", () => {
  it("вкладка кейсов доступна, три карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(3);
    for (const c of getCases("0")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("условие кейса 1 — список из восьми работ, эталон — таблица с этапами", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M0-CASE-01");
    expect(within(card).getAllByRole("listitem").filter((li) => /интервью с главным врачом/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(1);
    await submit(card, "1) Потребность");
    const pre = card.querySelector("pre")?.textContent ?? "";
    expect(pre).toContain("Проектирование");
    expect(pre).toContain("спецификация API");
  });

  it("эталон кейса 2 показывает распределение ролей, эталон кейса 3 — порядок изучения", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card2 = await passGate("M0-CASE-02");
    await submit(card2, "Владелец продукта утверждает цель");
    expect(card2.querySelector("pre")?.textContent).toContain("системный аналитик");
    const card3 = await passGate("M0-CASE-03");
    await submit(card3, "Сначала SQL, затем API");
    expect(card3.querySelector("pre")?.textContent).toContain("Порядок изучения: 3, 9, 8, 12");
  });
});
