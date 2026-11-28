import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkClassDiagram } from "./checkClass";
import { renderClass } from "./renderClass";

const DEBOUNCE_MS = 500;

/** Корректный пример: магазин «Накарабине» из главы 8 модуля 4. */
export const GOOD_SAMPLE = `classDiagram
  class Customer {
    -String name
    -String email
    +placeOrder()
  }
  class Order {
    -int number
    -Date createdAt
    +addProduct()
    +total() int
  }
  class OrderItem {
    -int quantity
    +cost() int
  }
  class Product {
    -String title
    -int price
    +changePrice(price int)
  }
  class Category {
    -String title
  }
  Customer "1" --> "0..*" Order : makes
  Order "1" *-- "1..*" OrderItem : contains
  Product "1" --> "0..*" OrderItem : appears in
  Category "1" o-- "0..*" Product : groups
`;

/** Пример с ошибками: каждая ошибка вызывает своё замечание. */
export const BAD_SAMPLE = `classDiagram
  class Customer {
    name
    +String email
    +String email
  }
  class Order {
    -int number
  }
  class Product
  class Warehouse {
    -String address
  }
  Customer --> Order
  Order "0..*" --> "0..*" Product : contains
  Order --> Basket : uses
`;

/** Тренажёр диаграммы классов: поле ввода Mermaid, предпросмотр и замечания по правилам (версия 2). */
export default function ClassTrainerView() {
  const [text, setText] = useState(GOOD_SAMPLE);
  const [settled, setSettled] = useState(GOOD_SAMPLE);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Текст, для которого предпросмотр уже построен (или завершился ошибкой): по нему видно, идёт ли загрузка.
  const [rendered, setRendered] = useState<string | null>(null);

  // Пауза в вводе: предпросмотр и проверка обновляются через 500 мс после последнего символа.
  useEffect(() => {
    const t = setTimeout(() => setSettled(text), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (settled.trim() === "") return;
    let active = true;
    renderClass(settled)
      .then((r) => {
        if (!active) return;
        if (r.ok) {
          setSvg(r.svg);
          setError(null);
        } else {
          // Предпросмотр не ломается: последний удачный график остаётся на месте.
          setError(r.message);
        }
        setRendered(settled);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(`Не удалось загрузить Mermaid: ${e instanceof Error ? e.message : String(e)}`);
        setRendered(settled);
      });
    return () => {
      active = false;
    };
  }, [settled]);

  const empty = settled.trim() === "";
  const loading = !empty && rendered !== settled;
  const check = useMemo(() => checkClassDiagram(settled), [settled]);

  function use(sample: string) {
    setText(sample);
    setSettled(sample);
  }

  return (
    <section aria-labelledby="class-title" className="sandbox">
      <h2 id="class-title">Тренажёр диаграммы классов</h2>
      <p className="muted">
        Опишите диаграмму в формате Mermaid classDiagram. Предпросмотр и замечания обновляются через {DEBOUNCE_MS} мс
        после паузы в вводе. Видимость атрибута: <code>+</code> открытый, <code>-</code> закрытый, <code>#</code>{" "}
        защищённый.
      </p>
      <div className="flex gap-2 py-2">
        <Button type="button" variant="secondary" onClick={() => use(GOOD_SAMPLE)}>
          Корректный пример
        </Button>
        <Button type="button" variant="secondary" onClick={() => use(BAD_SAMPLE)}>
          Пример с ошибками
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="class-source">Диаграмма (Mermaid)</Label>
          <Textarea
            id="class-source"
            rows={20}
            className="font-mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div>
          <h3>Предпросмотр</h3>
          {loading && svg === null && !empty && <p className="muted">Загрузка предпросмотра…</p>}
          {!empty && svg !== null && (
            <div role="img" aria-label="График диаграммы классов" className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
          {empty && <p className="muted">Введите диаграмму, чтобы увидеть график.</p>}
          <div role="status" aria-live="polite">
            {!empty && error !== null && <pre className="feedback feedback--bad whitespace-pre-wrap">Ошибка в диаграмме: {error}</pre>}
          </div>
        </div>
      </div>

      <h3>Замечания</h3>
      {check.syntaxErrors.length > 0 ? (
        <>
          <p className="muted">Правила не проверены: сначала исправьте синтаксис.</p>
          <ul>
            {check.syntaxErrors.map((e, i) => (
              <li key={i}>
                Строка {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </>
      ) : check.remarks.length === 0 ? (
        <p className="feedback feedback--ok">Замечаний нет.</p>
      ) : (
        <ul>
          {check.remarks.map((r, i) => (
            <li key={i}>
              {r.message} <span className="muted">Источник: {r.source}.</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
