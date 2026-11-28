import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkOpenApi } from "./checkOpenApi";

const DEBOUNCE_MS = 300;

/** Корректный пример: операции записи «Виты» из модуля 12. */
export const GOOD_SAMPLE = `openapi: 3.1.1
info:
  title: Вита. Онлайн-запись
  version: 0.1.0
paths:
  /appointments:
    post:
      operationId: createAppointment
      summary: Создать запись на приём
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AppointmentRequest'
      responses:
        '201':
          description: Запись создана
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Appointment'
        '409':
          $ref: '#/components/responses/SlotTaken'
  /appointments/{appointmentId}:
    parameters:
      - $ref: '#/components/parameters/AppointmentId'
    get:
      operationId: getAppointment
      summary: Получить запись
      responses:
        '200':
          description: Запись найдена
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Appointment'
        '404':
          description: Запись не найдена
components:
  parameters:
    AppointmentId:
      name: appointmentId
      in: path
      required: true
      schema:
        type: string
  schemas:
    AppointmentRequest:
      type: object
      required: [patientId, slotId]
      properties:
        patientId:
          type: string
        slotId:
          type: string
    Appointment:
      allOf:
        - $ref: '#/components/schemas/AppointmentRequest'
        - type: object
          required: [appointmentId, status]
          properties:
            appointmentId:
              type: string
            status:
              type: string
  responses:
    SlotTaken:
      description: Окно уже занято другим пациентом
`;

/** Пример с ошибками: у каждой строки замечаний есть соответствующая ошибка в тексте. */
export const BAD_SAMPLE = `openapi: 3.0.3
info:
  title: Вита. Онлайн-запись
paths:
  appointments/{appointmentId}:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Appointment'
  /patients:
    get:
      operationId: listPatients
      responses:
        '200':
          description: Список пациентов
    post:
      operationId: listPatients
      responses:
        '201':
          description: Пациент создан
components:
  schemas:
    Patient:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
`;

/** Тренажёр OpenAPI: поле ввода YAML и замечания по правилам структуры (версия 2). */
export default function OpenApiTrainerView() {
  const [text, setText] = useState(GOOD_SAMPLE);
  const [settled, setSettled] = useState(GOOD_SAMPLE);

  // Пауза в вводе: проверка обновляется через 300 мс после последнего символа.
  useEffect(() => {
    const t = setTimeout(() => setSettled(text), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const empty = settled.trim() === "";
  const result = useMemo(() => (empty ? null : checkOpenApi(settled)), [settled, empty]);

  return (
    <section aria-labelledby="openapi-title" className="sandbox">
      <h2 id="openapi-title">Тренажёр OpenAPI</h2>
      <p className="muted">
        Вставьте спецификацию OpenAPI 3.1 в формате YAML. Проверяется только структура документа: версия, обязательные
        поля, операции, ответы, параметры пути, ссылки <code>$ref</code>. Запросы к API не отправляются, а полнота
        описания остаётся на вашей совести: перед использованием в проекте прогоните документ через валидатор.
      </p>
      <div className="flex gap-2 py-2">
        <Button type="button" variant="secondary" onClick={() => { setText(GOOD_SAMPLE); setSettled(GOOD_SAMPLE); }}>
          Корректный пример
        </Button>
        <Button type="button" variant="secondary" onClick={() => { setText(BAD_SAMPLE); setSettled(BAD_SAMPLE); }}>
          Пример с ошибками
        </Button>
      </div>
      <Label htmlFor="openapi-source">Спецификация (YAML)</Label>
      <Textarea
        id="openapi-source"
        rows={22}
        className="font-mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />

      <h3>Замечания</h3>
      <div role="status" aria-live="polite">
        {empty && <p className="muted">Вставьте спецификацию, чтобы увидеть замечания.</p>}
        {result && result.syntaxErrors.length > 0 && (
          <>
            <p className="feedback feedback--bad">Правила не проверены: сначала исправьте YAML.</p>
            <ul>
              {result.syntaxErrors.map((e, i) => (
                <li key={i}>
                  {e.line !== undefined ? `Строка ${e.line}: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
          </>
        )}
        {result && result.syntaxErrors.length === 0 && (
          <>
            <p className="muted">
              Найдено путей: {result.stats.paths}, операций: {result.stats.operations}.
            </p>
            {result.remarks.length === 0 ? (
              <p className="feedback feedback--ok">Замечаний нет.</p>
            ) : (
              <>
                <p className="feedback feedback--bad">Замечаний: {result.remarks.length}.</p>
                <ul>
                  {result.remarks.map((r, i) => (
                    <li key={i}>
                      {r.message} <span className="muted">Где: {r.where}. Источник: {r.source}.</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
