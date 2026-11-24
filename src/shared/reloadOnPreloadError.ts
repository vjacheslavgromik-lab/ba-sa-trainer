// После нового деплоя имена ленивых файлов меняются, а открытая вкладка ещё ссылается на старые.
// Vite сообщает об этом событием vite:preloadError. Один раз перезагружаем страницу, чтобы подтянуть новую сборку.
const KEY = "ba-sa-preload-reload";
const MIN_INTERVAL_MS = 10_000;

export function reloadOnPreloadError(reload: () => void = () => window.location.reload()): void {
  window.addEventListener("vite:preloadError", (event) => {
    try {
      const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < MIN_INTERVAL_MS) return; // уже перезагружались: покажем ошибку, а не зациклимся
      window.sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      return; // хранилище недоступно: без защиты от цикла не перезагружаем
    }
    event.preventDefault();
    reload();
  });
}
