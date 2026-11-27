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
  window.location.hash = "#/modules/12/cases";
});

async function passGate(caseId: string) {
  const c = getCases("12").find((x) => x.id === caseId)!;
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

describe("страница кейсов модуля 12", () => {
  it("вкладка кейсов доступна, четыре карточки", async () => {
    render(<App />);
    expect(await screen.findAllByRole("heading", { level: 3, name: "Теория" })).toHaveLength(4);
    for (const c of getCases("12")) expect(screen.getByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
  });

  it("условие кейса 1 — список из пяти ожиданий заказчика, эталон — блок кода с таблицей", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M12-CASE-01");
    expect(within(card).getAllByRole("listitem").filter((li) => /Не должно тормозить/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(1);
    await submit(card, "АТ-1: поиск слотов за 2 секунды");
    const pre = card.querySelector("pre")?.textContent ?? "";
    expect(pre).toContain("АТ-5");
    expect(pre).toContain("Сага записи с компенсациями");
  });

  it("эталон кейса 2 показывает сагу с компенсациями и события", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M12-CASE-02");
    await submit(card, "Оркестрация, оркестратор — сервис записей");
    const pre = card.querySelector("pre")?.textContent ?? "";
    expect(pre).toContain("Компенсации в обратном порядке");
    expect(pre).toContain("ПредоплатаВозвращена");
  });

  it("эталон кейса 4 содержит блоки YAML с OpenAPI и AsyncAPI", async () => {
    render(<App />);
    await screen.findAllByRole("heading", { level: 3, name: "Теория" });
    const card = await passGate("M12-CASE-04");
    await submit(card, "openapi: 3.1.1");
    const pres = [...card.querySelectorAll("pre")].map((p) => p.textContent ?? "");
    expect(pres.some((t) => t.includes("openapi: 3.1.1") && t.includes("$ref"))).toBe(true);
    expect(pres.some((t) => t.includes("asyncapi: 3.1.0"))).toBe(true);
  });
});
