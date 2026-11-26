// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ErCasePractice from "../../src/features/er/ErCasePractice";
import { getCases } from "../../src/content/loader";

const reference = readFileSync(join(process.cwd(), "tests/fixtures/er/rental-reference.mmd"), "utf8");
const data = getCases("4")[0];
const field = () => screen.getByLabelText("Ваша ER-диаграмма (Mermaid erDiagram)") as HTMLTextAreaElement;
const setText = (text: string) => fireEvent.change(field(), { target: { value: text } });
const check = () => userEvent.click(screen.getByRole("button", { name: "Проверить диаграмму" }));

beforeEach(() => cleanup());

describe("практика ER-кейса (US-5.3)", () => {
  it("начинается с заголовка erDiagram; эталон скрыт до решения", () => {
    render(<ErCasePractice data={data} initialText="" solved={false} onSolved={() => {}} />);
    expect(field().value).toBe("erDiagram\n");
    expect(screen.getByText(/Эталонное решение появится/)).toBeTruthy();
  });

  it("верная модель: «Замечаний нет», вызван onSolved с текстом диаграммы", async () => {
    const onSolved = vi.fn();
    render(<ErCasePractice data={data} initialText="" solved={false} onSolved={onSolved} />);
    setText(reference);
    await check();
    expect(await screen.findByText("Замечаний нет.")).toBeTruthy();
    expect(onSolved).toHaveBeenCalledWith(reference);
  });

  it("неполная модель: замечания общих правил с источником и правил кейса, кейс не засчитан", async () => {
    const onSolved = vi.fn();
    render(<ErCasePractice data={data} initialText="" solved={false} onSolved={onSolved} />);
    setText(`erDiagram
  CUSTOMER ||--o{ RENTAL
  CUSTOMER {
    int id
  }
  RENTAL {
    int id PK
  }
`);
    await check();
    expect(await screen.findByText(/Замечаний: \d+/)).toBeTruthy();
    expect(screen.getByText(/В сущности «CUSTOMER» нет первичного ключа/)).toBeTruthy();
    expect(screen.getByText(/У связи «CUSTOMER» — «RENTAL» нет названия/)).toBeTruthy();
    expect(screen.getByText("В модели нет сущности «Снаряжение».")).toBeTruthy();
    expect(screen.getByText("У сущности «Клиент» нет атрибута «телефон».")).toBeTruthy();
    expect(screen.getAllByText(/Источник: Коннолли, Бегг/).length).toBeGreaterThan(0);
    expect(onSolved).not.toHaveBeenCalled();
  });

  it("синтаксическая ошибка: показана строка, правила не проверяются", async () => {
    render(<ErCasePractice data={data} initialText="" solved={false} onSolved={() => {}} />);
    setText("erDiagram\n  это не диаграмма\n");
    await check();
    expect(await screen.findByText("Правила не проверены: сначала исправьте синтаксис.")).toBeTruthy();
    expect(screen.getByText(/Строка 2:/)).toBeTruthy();
  });

  it("кнопка заблокирована при пустом поле", () => {
    render(<ErCasePractice data={data} initialText="" solved={false} onSolved={() => {}} />);
    setText("   ");
    expect((screen.getByRole("button", { name: "Проверить диаграмму" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("решённый кейс: поле заблокировано, показан эталон", () => {
    render(<ErCasePractice data={data} initialText={reference} solved onSolved={() => {}} />);
    expect(field().disabled).toBe(true);
    expect(screen.getByText("Кейс засчитан.")).toBeTruthy();
    expect(screen.getByText(/Эталон \(черновик, требует рецензии\)/)).toBeTruthy();
  });
});
