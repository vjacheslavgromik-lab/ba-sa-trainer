// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { reloadOnPreloadError } from "../../src/shared/reloadOnPreloadError";

function fire(): Event {
  const event = new Event("vite:preloadError", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

// Один обработчик на весь файл: в jsdom окно общее, а слушатели не снимаются.
const reload = vi.fn();
reloadOnPreloadError(reload);

beforeEach(() => {
  reload.mockClear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("перезагрузка при ошибке загрузки ленивого файла", () => {
  it("перезагружает страницу и гасит ошибку при первом сбое", () => {
    const event = fire();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("не зацикливается: повторный сбой сразу после перезагрузки показывает ошибку", () => {
    fire();
    reload.mockClear();
    const event = fire();
    expect(reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("перезагружает снова, если с прошлой перезагрузки прошло больше 10 секунд", () => {
    window.sessionStorage.setItem("ba-sa-preload-reload", String(Date.now() - 11_000));
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("не перезагружает, если хранилище недоступно", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("недоступно");
    });
    const event = fire();
    expect(reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
