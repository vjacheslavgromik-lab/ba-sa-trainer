// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PostmanCasePractice from "../../src/features/postman/PostmanCasePractice";
import { getCases } from "../../src/content/loader";

const validText = readFileSync(join(process.cwd(), "tests/fixtures/postman/school-valid.json"), "utf8");
const data = getCases("9")[0];
const file = (content: string, name = "school.json") => new File([content], name, { type: "application/json" });
const upload = (f: File) => userEvent.upload(screen.getByLabelText("Ваша коллекция Postman"), f);

beforeEach(() => cleanup());

describe("практика Postman-кейса (US-8.3)", () => {
  it("верная коллекция: кейс засчитан и вызван onSolved с именем файла", async () => {
    const onSolved = vi.fn();
    render(<PostmanCasePractice data={data} initialFileName="" solved={false} onSolved={onSolved} />);
    await upload(file(validText, "school.json"));
    await waitFor(() => expect(onSolved).toHaveBeenCalledWith("school.json"));
    expect(await screen.findByText(/Нарушений нет/)).toBeTruthy();
  });

  it("нарушения правила кейса: показаны, кейс не засчитан", async () => {
    const c = JSON.parse(validText);
    c.item[0].item = c.item[0].item.filter((r: { name: string }) => r.name !== "Студент не найден");
    const onSolved = vi.fn();
    render(<PostmanCasePractice data={data} initialFileName="" solved={false} onSolved={onSolved} />);
    await upload(file(JSON.stringify(c)));
    const table = await screen.findByRole("table", { name: /Нарушения в коллекции/ });
    expect(table.textContent).toContain("нет проверки кода 404");
    expect(onSolved).not.toHaveBeenCalled();
    expect(screen.getByText(/Эталонное решение появится/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Проверить снова" })).toBeTruthy();
  });

  it("файл не коллекция: сообщение, кейс не засчитан", async () => {
    const onSolved = vi.fn();
    render(<PostmanCasePractice data={data} initialFileName="" solved={false} onSolved={onSolved} />);
    await upload(file("это не json"));
    expect(await screen.findByText("Файл не является коллекцией Postman")).toBeTruthy();
    expect(onSolved).not.toHaveBeenCalled();
  });

  it("решённый кейс показывает имя файла и эталон", () => {
    render(<PostmanCasePractice data={data} initialFileName="school.json" solved onSolved={() => {}} />);
    expect(screen.getByText(/Кейс засчитан: коллекция «school.json»/)).toBeTruthy();
    expect(screen.getByText(/папка «Студенты» с тремя запросами/)).toBeTruthy();
  });
});
