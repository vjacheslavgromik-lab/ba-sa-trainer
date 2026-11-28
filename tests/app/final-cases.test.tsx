// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/app/App";
import { getCases } from "../../src/content/loader";

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
  window.location.hash = "#/modules/final/cases";
});

describe("страница кейсов выпускного проекта", () => {
  it("шесть карточек этапов, шага «Теория» нет, практика открыта сразу", async () => {
    render(<App />);
    for (const c of getCases("final")) expect(await screen.findByRole("heading", { name: `Практика: «${c.title}»` })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3, name: "Теория" })).toBeNull();
    expect(screen.queryAllByText(/Кейс откроется после/)).toHaveLength(0);
    expect(screen.queryAllByText(/Порог пройден/)).toHaveLength(0);
  });

  it("этап 1: протокол показан списком; после ответа появляются чек-лист и эталон с таблицей требований", async () => {
    render(<App />);
    const c = getCases("final")[0];
    const card = await screen.findByRole("region", { name: c.title });
    expect(within(card).getAllByRole("listitem").some((li) => /Два пункта проката/.test(li.textContent ?? ""))).toBe(true);
    await userEvent.click(within(card).getByLabelText("Ваш ответ"));
    await userEvent.paste("Вопросы заказчику: 1) Какая цель?");
    await userEvent.click(within(card).getByRole("button", { name: /Отправить/ }));
    expect(within(card).getByText(/Кейс не засчитан/)).toBeTruthy();
    const pre = [...card.querySelectorAll("pre")].map((p) => p.textContent ?? "");
    expect(pre.some((t) => t.includes("ФТ-2") && t.includes("НФТ-5"))).toBe(true);
  });

  it("этап 3: ER-диаграмма из эталона принимается тренажёром, после этого эталон показан с таблицей и SQL", async () => {
    render(<App />);
    const c = getCases("final")[2];
    const source = /```text\n(erDiagram[\s\S]*?)```/.exec(c.reference)![1];
    const card = await screen.findByRole("region", { name: c.title });
    const area = within(card).getByLabelText(/Ваша ER-диаграмма/);
    await userEvent.clear(area);
    await userEvent.click(area);
    await userEvent.paste(source);
    await userEvent.click(within(card).getByRole("button", { name: "Проверить диаграмму" }));
    expect(await within(card).findByText("Замечаний нет.")).toBeTruthy();
    expect(within(card).getByText("Кейс засчитан.")).toBeTruthy();
    expect(card.querySelector("table")).not.toBeNull();
    expect([...card.querySelectorAll("pre")].some((p) => (p.textContent ?? "").includes("CREATE TABLE customer"))).toBe(true);
  });

  it("этап 3: неполная диаграмма не принимается, эталон остаётся скрытым", async () => {
    render(<App />);
    const c = getCases("final")[2];
    const card = await screen.findByRole("region", { name: c.title });
    const area = within(card).getByLabelText(/Ваша ER-диаграмма/);
    await userEvent.clear(area);
    await userEvent.click(area);
    await userEvent.paste('erDiagram\n  CUSTOMER {\n    int id PK\n    string phone\n  }\n');
    await userEvent.click(within(card).getByRole("button", { name: "Проверить диаграмму" }));
    expect(await within(card).findByText(/Замечаний:/)).toBeTruthy();
    expect(within(card).getByText(/Эталонное решение появится/)).toBeTruthy();
  });
});
