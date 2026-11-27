---
module: 12
sprint: 12
title: "Проектирование спецификации OpenAPI на YAML"
source: "OpenAPI Specification v3.1.1, 24 октября 2024 (https://spec.openapis.org/oas/v3.1.1.html). Прочитаны дословно разделы 0–4.4.2 и 4.8.20–4.8.24.6.6 (в частности «Reference Object» и примеры использования $ref в «Schema Object»); остальные разделы, включая Components Object, Paths и Operation, в этот раз прочитаны не дословно: названия разделов подтверждены оглавлением. Предварительно нужны глава 8 модуля 9 и глава 7 этого модуля. Пример «Виты» — рабочий материал курса, внешним валидатором не проверялся, проверяется тестом на разбор YAML и целостность ссылок."
reviewStatus: draft
---

**Цель главы.** Вы научитесь собирать спецификацию OpenAPI по набору операций: структура документа, повторное использование через `components` и `$ref`, проверка собственной работы.

## Зачем эта глава

В главе 8 модуля 9 вы читали готовую спецификацию API школы. Здесь вы собираете её сами по результатам высокоуровневого проекта (глава 7). Спецификация — договор между командами: по ней пишут сервер, клиента, тесты и документацию.

Формат: документ OpenAPI может быть записан в JSON или в YAML. YAML удобнее для человека, потому что в нём меньше скобок и кавычек, но отступы значимы: ошибка в количестве пробелов меняет смысл.

## Структура документа

Спецификация версии 3.1.1 (24 октября 2024) требует, чтобы в документе было поле `openapi` с версией и хотя бы одно из полей `paths`, `components` или `webhooks`.

| Раздел | Назначение |
|---|---|
| `openapi` | версия спецификации, по которой записан документ |
| `info` | название, версия API, описание |
| `servers` | адреса, по которым API доступен |
| `paths` | пути и операции над ними |
| `components` | повторно используемые описания: схемы данных, параметры, ответы, схемы безопасности |

В спецификации у каждого из этих разделов есть свой объект (Info Object, Server Object, Paths Object, Components Object и другие).

## Повторное использование: `$ref`

Если один и тот же ответ «слот занят» нужен в пяти операциях, его не копируют, а описывают один раз в `components` и подключают ссылкой.

Спецификация определяет **Reference Object** как простой объект для ссылки на другие компоненты описания, внутри документа и снаружи. Его значение `$ref` — это идентификатор ресурса (URI), поле обязательно. Объект нельзя расширять дополнительными свойствами: добавленные игнорируются. Пример из спецификации: `{"$ref": "#/components/schemas/Pet"}`. В схемах можно собирать новую схему из существующих через `allOf`: спецификация показывает примеры с `$ref` на схемы из `components.schemas`.

Ссылка `#/components/schemas/Appointment` читается так: `#` — «этот же документ», дальше путь внутрь него.

## Пример: операции записи «Виты»

Ниже спецификация для двух операций, созданных в главе 7: создать запись и отменить. Прочитайте её сверху вниз.

```yaml
openapi: 3.1.1
info:
  title: Вита. Онлайн-запись
  version: 0.1.0
servers:
  - url: https://api.vita.example/v1
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
        '404':
          $ref: '#/components/responses/NotFound'
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
          $ref: '#/components/responses/NotFound'
  /appointments/{appointmentId}/cancellation:
    parameters:
      - $ref: '#/components/parameters/AppointmentId'
    post:
      operationId: cancelAppointment
      summary: Отменить запись
      responses:
        '200':
          description: Запись отменена
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Appointment'
        '404':
          $ref: '#/components/responses/NotFound'
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
      required: [patientId, slotId, serviceCode]
      properties:
        patientId:
          type: string
        slotId:
          type: string
        serviceCode:
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
              enum: [booked, canceled]
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
  responses:
    NotFound:
      description: Запись или пациент не найдены
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    SlotTaken:
      description: Слот уже занят
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
```

### Как читать пример

- Общие вещи вынесены в `components`: параметр пути `AppointmentId` нужен двум путям, ошибка `NotFound` встречается в трёх операциях.
- Схема `Appointment` собрана из `AppointmentRequest` и дополнительных полей `appointmentId` и `status` (`allOf`): поля запроса не дублируются.
- Каждая операция имеет уникальный `operationId`: по нему генерируют код клиента и ссылаются на операцию в документации.
- Отмена записи оформлена как `POST` на подресурс `cancellation`: это действие, а не удаление; запись остаётся в системе со статусом `canceled` (решение главы 7).

## Типичные ошибки

| Ошибка | Последствие |
|---|---|
| Ссылка на несуществующий компонент (`#/components/schemas/Apointment`) | инструменты не могут построить документацию, генерация ломается |
| Копирование одной и той же схемы в разных местах | при изменении одно место забывают обновить |
| Операции без описания ответов об ошибках | потребитель не знает, что делать при 404 и 409 |
| Отступы в YAML сбиты | поле оказывается не там, где задумано, а ошибку замечают поздно |
| `operationId` повторяется | генератор кода выдаёт конфликт имён |

## Как проверить свою спецификацию

1. **Прочитать как потребитель.** По документу понятно, какие операции есть, что отправлять и что приходит?
2. **Проверить ссылки.** У каждого `$ref` есть адресат в `components`.
3. **Проверить обязательные поля.** В схемах указаны `required`, у операций есть ответы.
4. **Проверить на примерах.** Составьте пример запроса и ответа и убедитесь, что он соответствует схеме (в модуле 9 для этого используют Postman).
5. **Прогнать через инструмент.** Для настоящего проекта используют валидаторы и средства просмотра спецификаций, которые разбирают документ по правилам спецификации. Здесь приложение проверку OpenAPI не выполняет: это запланированное улучшение.

## Проверьте себя

- Какие разделы верхнего уровня есть в документе OpenAPI и для чего каждый?
- Чем `$ref` полезен и что нельзя добавлять рядом с ним?
- Что делает `allOf` в схеме `Appointment`?
- Почему `operationId` должен быть уникальным?
- Назовите три способа проверить спецификацию до передачи разработчикам.

## Итоги

- Спецификация OpenAPI — договор, который записывают на YAML или JSON.
- Структура: `openapi`, `info`, `servers`, `paths`, `components`.
- Повторяющиеся части выносятся в `components` и подключаются через `$ref`.
- Качество спецификации проверяют чтением, целостностью ссылок, примерами и инструментами.
