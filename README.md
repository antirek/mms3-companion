# mms3-ask-bot

Бот для работы с документами в GigaChat AI среде, интегрированный с системой mms3/chat3.

## Структура проекта

Проект организован как npm workspaces:

- `packages/user-bot` - Процесс бота для обработки сообщений из chat3
- `packages/data-backend` - Backend API для управления файлами
- `packages/data-ui` - Vue3 приложение для управления файлами
- `packages/shared` - Общие утилиты и модели

## Установка

```bash
npm install
```

## Настройка

1. Скопируйте `.env.example` в `.env` и заполните переменные окружения
2. Убедитесь, что MongoDB запущена локально
3. Настройте доступы к GigaChat, Chat3 и RabbitMQ

## Запуск

### Разработка

Запустить все процессы:
```bash
npm run dev:all
```

Запустить отдельные процессы:
```bash
npm run dev:user-bot      # Бот
npm run dev:data-backend  # Backend API
npm run dev:data-ui      # Vue3 приложение
```

### Production

Запустить все процессы:
```bash
npm run start:all
```

Запустить отдельные процессы:
```bash
npm run start:user-bot      # Бот
npm run start:data-backend  # Backend API
```

Перед запуском в production необходимо собрать UI:
```bash
npm run build:data-ui
```

## Использование

1. Запустите `data-backend` и `data-ui`
2. Откройте браузер на `http://localhost:3001`
3. Загрузите .txt файлы через UI
4. Нажмите "Загрузить в GigaChat" для каждого файла
5. Запустите `user-bot` для обработки сообщений

## API Endpoints

- `GET /api/files` - Список всех файлов
- `POST /api/files/upload` - Загрузка файла
- `POST /api/files/:id/upload-to-gigachat` - Загрузка в GigaChat
- `DELETE /api/files/:id` - Удаление из БД
- `DELETE /api/files/:id/gigachat` - Удаление из GigaChat
- `GET /api/files/uploaded-ids` - Получить все file_id (для user-bot)

## Ограничения

- Поддерживаются только файлы `.txt`
- Максимальный размер файла: 5MB
- Все загруженные файлы используются для каждого вопроса
