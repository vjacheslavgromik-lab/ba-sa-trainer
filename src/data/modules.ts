export type ModuleStatus = "not_started" | "in_progress" | "done" | "planned";

export interface ModuleInfo {
  id: string;
  number: string;
  title: string;
  result: string;
  slice: boolean;
  wave: 1 | 2 | 3 | 4;
}

export const MODULES: ModuleInfo[] = [
  { id: "0", number: "0", title: "Вводный курс", result: "Понимание роли и жизненного цикла", slice: false, wave: 4 },
  { id: "1", number: "1", title: "Профессия системного аналитика", result: "Модели разработки, жизненный цикл, архитектура клиент-сервер", slice: false, wave: 3 },
  { id: "2", number: "2", title: "Разработка требований", result: "Use Case, спецификация, трассировка", slice: true, wave: 1 },
  { id: "3", number: "3", title: "SQL для аналитиков", result: "Запросы, объединения, подзапросы", slice: true, wave: 1 },
  { id: "4", number: "4", title: "Моделирование данных", result: "ER-диаграммы, классы, нормализация, словарь данных", slice: false, wave: 2 },
  { id: "5", number: "5", title: "Моделирование процессов", result: "BPMN, диаграммы состояний, DFD", slice: false, wave: 3 },
  { id: "6", number: "6", title: "Пользовательские интерфейсы", result: "Персоны, сценарии, карта сайта, прототипы", slice: false, wave: 3 },
  { id: "7", number: "7", title: "Agile-практики", result: "User Stories, INVEST, User Story Map, MVP", slice: false, wave: 2 },
  { id: "8", number: "8", title: "Архитектура системы", result: "Стили архитектуры, компонентная и развёртывания диаграммы", slice: false, wave: 2 },
  { id: "9", number: "9", title: "Программные интерфейсы (API)", result: "REST, SOAP, протоколы, Sequence Diagram, проверка Postman", slice: true, wave: 1 },
  { id: "10", number: "10", title: "Реализация системы", result: "Тест-план, тест-кейсы, CI/CD на уровне аналитика", slice: false, wave: 4 },
  { id: "11", number: "11", title: "Поддержка и внедрение", result: "ПМИ, руководство пользователя, план миграции, ГОСТ", slice: false, wave: 4 },
  { id: "12", number: "12", title: "Расширенная архитектура", result: "C4, DDD, событийная архитектура, OpenAPI", slice: false, wave: 4 },
  { id: "final", number: "—", title: "Выпускной проект", result: "Сквозной кейс: требования, процессы, данные, прототип, ПМИ", slice: false, wave: 4 },
];

/**
 * Опубликованные волны контента (US-8.5). Модули опубликованных волн отмечены «Доступен»,
 * модули остальных волн — «В разработке». Новая волна включается добавлением номера.
 */
export const PUBLISHED_WAVES: readonly number[] = [1];

export function isModulePublished(m: ModuleInfo, published: readonly number[] = PUBLISHED_WAVES): boolean {
  return published.includes(m.wave);
}

/** Модули, у которых есть тренажёр: остальным вкладка «Тренажёры» показывает «В разработке» (US-8.4). */
export const MODULES_WITH_TRAINER: readonly string[] = ["3", "4", "9"];

export function findModule(id: string | undefined): ModuleInfo | undefined {
  return MODULES.find((m) => m.id === id);
}

/** Подпись модуля в кнопках перехода: у выпускного проекта нет номера. */
export function moduleLabel(m: ModuleInfo): string {
  return m.id === "final" ? m.title : `Модуль ${m.number}. ${m.title}`;
}

/** Соседние модули в порядке списка: у первого нет предыдущего, у последнего нет следующего. */
export function neighbours(id: string): { prev?: ModuleInfo; next?: ModuleInfo } {
  const i = MODULES.findIndex((m) => m.id === id);
  if (i < 0) return {};
  return { prev: MODULES[i - 1], next: MODULES[i + 1] };
}

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  not_started: "Не начат",
  in_progress: "В работе",
  done: "Выполнен",
  planned: "В разработке",
};
