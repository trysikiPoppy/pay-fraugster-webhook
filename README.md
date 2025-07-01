# Pay Republic → Fraugster Integration

Система интеграции между платежной платформой Pay Republic и антифрод-сервисом Fraugster для обработки транзакций в реальном времени.

## Архитектура

```
Pay Republic → Webhook → Express.js → Fraugster API
              (HMAC)    (обогащение)   (анализ)
```

### Компоненты системы

**Контроллеры:**

- **WebhookController**: Обработка HTTP запросов от Pay Republic

**Сервисы:**

- **WebhookService**: Основная бизнес-логика обработки транзакций
- **PayRepublicService**: OAuth авторизация и работа с API
- **FraugsterService**: Аутентификация сессий и отправка данных

**Middleware:**

- **validateWebhook**: HMAC-SHA256 проверка подписей
- **validatePayJson**: Валидация структуры JSON payload
- **security**: CORS, Helmet, rate limiting, request size limit
- **errorHandler**: Глобальная обработка ошибок и 404

**Утилиты:**

- **logger**: Winston-based логирование с ротацией файлов
- **TransactionLogger**: Специализированное логирование транзакций

**Типы:**

- **pay.types.ts**: TypeScript типы для Pay Republic API
- **fraugster.types.ts**: TypeScript типы для Fraugster API

## Требования к окружению

- Node.js 18+
- TypeScript 5.3+
- Express.js 4.18+
- Winston 3.11+ (логирование)
- Axios 1.6+ (HTTP клиент)

## Установка

```bash
# Установка зависимостей
npm install

# Сборка проекта
npm run build

# Запуск в продакшене
npm start

# Запуск в режиме разработки
npm run dev

# Тестирование webhook
npm run test:webhook
```

## Переменные окружения

```env
PORT=3000
NODE_ENV=production

PAY_API_URL=http://localhost:8080
PAY_CLIENT_ID=your_client_id
PAY_CLIENT_SECRET=your_client_secret
PAY_WEBHOOK_SECRET=your_webhook_secret

FRAUGSTER_API_URL=https://api.fraugsterapi.com
FRAUGSTER_USERNAME=your_username
FRAUGSTER_PASSWORD=your_password
```

## API Endpoints

### POST /webhook

Основной endpoint для получения webhooks от Pay Republic.

**Headers:**

- `Content-Type: application/json`
- `digest: sha1_hash_of_body`
- `signature: fr1=:hmac_signature:`
- `signature-input: fr1=("digest");created=timestamp`

**Response:**

- `200 OK` - Транзакция успешно обработана
- `401 Unauthorized` - Неверная подпись или отсутствуют заголовки
- `400 Bad Request` - Неверная структура данных
- `500 Internal Server Error` - Ошибка обработки

### GET /health

Проверка состояния сервиса.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-06-19T13:55:25.091Z",
  "version": "1.0.0"
}
```

## Безопасность

### HMAC Signature Validation

Все webhooks проверяются с помощью HMAC-SHA256 подписей:

1. Вычисляется SHA1 хеш от тела запроса
2. Создается строка подписи: `"digest": "hash"\n@signature-params: params`
3. Подпись проверяется с помощью секретного ключа

### Smart Rate Limiting

- **Лимиты**: 100 запросов/минуту для webhook endpoint
- **Skip логика**: Автоматически пропускает запросы с User-Agent содержащим "pay-republic" или "webhook"
- **SlowDown**: После 50 запросов добавляет задержку 200ms (максимум 2 секунды)
- **Response**: Возвращает 429 с заголовками `retry-after`
- **Scope**: Применяется только к `/webhook`, health endpoint без ограничений

### CORS Policy

Разрешены запросы только от доменов Pay Republic:

- `http://localhost:3000`
- `http://localhost:8080`
- `http://localhost:4000`
- `http://localhost:5000`

**Настройки:**

- **Methods**: `POST` только
- **Headers**: `Content-Type`, `Authorization`, `digest`, `signature`, `signature-input`
- **Credentials**: `false`
- **Логирование**: Блокированные запросы логируются с событием `cors_blocked`

### Security Headers

- Content Security Policy
- HSTS (31536000 seconds)
- X-Frame-Options
- X-Content-Type-Options
- Request Size Limit (1MB)

## Логирование

Система логирует все важные события:

- **logs/transactions.log** - Основные события транзакций (50MB x 30)
- **logs/error.log** - Ошибки системы (10MB x 10)
- **logs/combined.log** - Все события (20MB x 15)

### Типы событий

**Основные события:**

- `webhook_received` - Получение webhook от Pay Republic
- `signature_validation` - Проверка HMAC подписи
- `fraugster_response` - Ответ от Fraugster API
- `processing_error` - Ошибки обработки

**Валидация и безопасность:**

- `json_validation_failed` - Ошибка структуры JSON
- `json_validation_warning` - Предупреждения валидации
- `webhook_validation_failed` - Ошибка проверки подписи
- `validation_errors` - Ошибки валидации данных Fraugster
- `rate_limit_exceeded` - Превышение лимитов запросов
- `cors_blocked` - Блокировка CORS
- `request_too_large` - Превышение размера запроса

**Системные события:**

- `server_start` - Запуск сервера
- `startup_error` - Ошибка запуска
- `global_error` - Глобальная ошибка
- `route_not_found` - Маршрут не найден
- `auth_error` - Ошибка аутентификации
- `api_error` - Ошибка API
- `pay_oauth_error` - Ошибка OAuth Pay Republic
- `session_token_expired` - Истечение токена сессии
- `transaction_stats` - Статистика транзакций

## Мониторинг

### Health Check

```bash
curl https://your-domain.com/health
```

### Логи приложения

```bash
tail -f logs/transactions.log
tail -f logs/error.log
```

### Метрики производительности

- Обработка запросов: ~50-100ms
- Throughput: до 100 RPS
- Memory usage: ~50-100MB
- Trust proxy: 1 level (Railway compatible)

## Обработка ошибок

### Graceful Shutdown

Сервер корректно обрабатывает SIGTERM и SIGINT сигналы для graceful shutdown в производственной среде.

### Проверка окружения

При запуске автоматически проверяются обязательные переменные окружения:

- `PAY_WEBHOOK_SECRET`
- `PAY_CLIENT_ID`
- `PAY_CLIENT_SECRET`
- `FRAUGSTER_USERNAME`
- `FRAUGSTER_PASSWORD`

При отсутствии любой из переменных сервер завершается с ошибкой `startup_error`.

### Error Recovery

- Автоматическое создание директории `logs/` при запуске
- Логирование всех ошибок для дальнейшего анализа
- Graceful обработка ошибок в middleware chain
- Сохранение полного контекста ошибок (headers, IP, stack trace)

## Troubleshooting

### Проблемы с подписью

- Проверьте правильность `PAY_WEBHOOK_SECRET`
- Убедитесь что заголовки `digest`, `signature`, `signature-input` присутствуют
- События: `webhook_validation_failed`, `signature_validation`

### Ошибки валидации JSON

- Проверьте структуру payload (обязательные поля: `id`, `event`, `data`)
- События: `json_validation_failed`, `json_validation_warning`

### Ошибки аутентификации Fraugster

- Убедитесь что `FRAUGSTER_USERNAME` и `FRAUGSTER_PASSWORD` корректны
- События: `auth_error`, `session_token_expired`

### Rate Limiting Issues

- Проверьте User-Agent заголовки (должен содержать "pay-republic" или "webhook")
- События: `rate_limit_exceeded`, `request_too_large`

### Проблемы с CORS

- Проверьте что запросы идут с разрешенных доменов Pay Republic
- События: `cors_blocked`

### API ошибки

- Fraugster API: события `api_error`, `validation_errors`
- Pay Republic API: события `pay_oauth_error`, `pay_api_error`

## Деплой в продакшен

### Railway

1. Создайте новый проект в Railway
2. Подключите Git репозиторий
3. Настройте переменные окружения
4. Деплой произойдет автоматически

### Environment Variables

Убедитесь что все переменные настроены для продакшена:

- `PAY_API_URL` должен указывать на ваш API сервер
- Используйте продакшн credentials для всех сервисов
- Установите `NODE_ENV=production`

### Webhook Configuration в Pay Republic

- **URL**: `https://your-app.up.railway.app/webhook`
- **Events**: `PAYMENT.UPDATED`, `PAYMENT.CREATED`, `PAYMENT.STATUS_UPDATED`
- **Secret**: Используйте сгенерированный secret key

## Версионирование

Версия: 1.0.0 (Production Ready)

### Основные зависимости

**Runtime:**

- express: 4.18.2
- axios: 1.6.7
- winston: 3.11.0
- helmet: 7.1.0
- cors: 2.8.5
- express-rate-limit: 7.1.5
- express-slow-down: 2.0.1
- dotenv: 16.4.1

**Development:**

- typescript: 5.3.3
- nodemon: 3.0.3
- ts-node: 10.9.2
- @types/express: 4.17.21
- @types/cors: 2.8.17
- @types/node: 20.11.16

## Архитектурные решения

### Trust Proxy Configuration

```typescript
app.set("trust proxy", 1); // Railway compatible
```

### Rate Limiting Strategy

**webhookRateLimit configuration:**

```typescript
windowMs: 1 * 60 * 1000,    // 1 минута
max: 100,                   // максимум запросов
skip: (req) => {
  const userAgent = req.get("User-Agent") || "";
  return userAgent.includes("pay-republic") || userAgent.includes("webhook");
}
```

**webhookSlowDown configuration:**

```typescript
windowMs: 1 * 60 * 1000,    // 1 минута
delayAfter: 50,             // после 50 запросов
delayMs: () => 200,         // задержка 200ms
maxDelayMs: 2000            // максимум 2 секунды
```

Эта конфигурация обеспечивает безопасность без блокировки легитимных webhooks от Pay Republic.
