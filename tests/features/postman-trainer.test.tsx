// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PostmanTrainerView from "../../src/features/postman/PostmanTrainerView";

const validText = readFileSync(join(process.cwd(), "tests/fixtures/postman/school-valid.json"), "utf8");
const file = (content: string, name = "collection.json") => new File([content], name, { type: "application/json" });
const upload = (f: File) => userEvent.upload(screen.getByLabelText("Загрузить коллекцию (файл JSON)"), f);

beforeEach(() => cleanup());

describe("тренажёр Postman (US-6.2)", () => {
  it("файл не JSON: сообщение без сбоя страницы", async () => {
    render(<PostmanTrainerView />);
    await upload(file("это не json"));
    expect(await screen.findByText("Файл не является коллекцией Postman")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Тренажёр Postman" })).toBeTruthy();
  });

  it("верная коллекция: нарушений нет", async () => {
    render(<PostmanTrainerView />);
    await upload(file(validText));
    expect(await screen.findByText(/Нарушений нет\. Проверено запросов: 9/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("запрос без кода 404: в списке есть запрос и правило", async () => {
    const c = JSON.parse(validText);
    c.item[0].item = c.item[0].item.filter((r: { name: string }) => r.name !== "Студент не найден");
    render(
      <PostmanTrainerView caseRules={{ requests: [{ method: "GET", path: "/students/{id}", statuses: [200, 404] }] }} />,
    );
    await upload(file(JSON.stringify(c)));
    const table = await screen.findByRole("table", { name: /Нарушения в коллекции/ });
    expect(table.textContent).toContain("C2. Обязательный код ответа");
    expect(table.textContent).toContain("Студенты / Студент по id");
    expect(table.textContent).toContain("нет проверки кода 404");
  });

  it("в нарушении есть ссылки на источники", async () => {
    const c = JSON.parse(validText);
    c.item[0].item[0].request.url.raw = "{{baseUrl}}/getStudents";
    render(<PostmanTrainerView />);
    await upload(file(JSON.stringify(c)));
    const link = await screen.findByRole("link", { name: /AIP-121/ });
    expect(link.getAttribute("href")).toBe("https://google.aip.dev/121");
  });

  it("после загрузки доступна кнопка «Проверить снова»", async () => {
    render(<PostmanTrainerView />);
    expect(screen.queryByRole("button", { name: "Проверить снова" })).toBeNull();
    await upload(file(validText));
    expect(await screen.findByRole("button", { name: "Проверить снова" })).toBeTruthy();
  });
});
