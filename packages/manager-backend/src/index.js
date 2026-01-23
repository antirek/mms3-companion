import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { Chat3Client } from 'chat3-client';
import { RabbitMQUpdatesClient } from './rabbitmq.js';
import { CompanionBotService } from './services/companionBotService.js';
import { GigaChatService } from './services/gigachatService.js';
import { FileService } from './services/fileService.js';
import dialogsRouter from './routes/dialogs.js';
import messagesRouter from './routes/messages.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Инициализация Chat3 клиента
const chat3Client = new Chat3Client({
  baseURL: config.chat3.apiUrl,
  apiKey: config.chat3.apiKey,
  tenantId: config.chat3.tenantId,
  debug: false,
});

// Передаем клиент и сервисы в роуты
app.locals.chat3Client = chat3Client;
app.locals.managerUserId = config.manager.userId;
app.locals.companionBotUserId = config.companionBot.userId;

// API routes
app.use('/api/dialogs', dialogsRouter);
app.use('/api/messages', messagesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'manager-backend' });
});

// Создаем HTTP сервер для WebSocket
const server = createServer(app);

// WebSocket сервер
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// WebSocket подключения
const clients = new Set();

wss.on('connection', (ws, req) => {
  console.log('WebSocket клиент подключен');
  clients.add(ws);

  // Отправляем приветственное сообщение
  ws.send(JSON.stringify({ type: 'connected', message: 'Подключено к серверу' }));

  ws.on('close', () => {
    console.log('WebSocket клиент отключен');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket ошибка:', error);
    clients.delete(ws);
  });
});

// Функция для broadcast сообщений всем клиентам
const broadcast = (data) => {
  const message = JSON.stringify(data);
  console.log(`[WebSocket Broadcast] Отправка сообщения ${data.type} всем клиентам:`, {
    type: data.type,
    dialogId: data.dialogId,
    messageId: data.message?.messageId,
    clientsCount: clients.size,
    messageLength: message.length
  });
  
  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(message);
        sentCount++;
        console.log(`[WebSocket Broadcast] ✅ Сообщение отправлено клиенту (${sentCount}/${clients.size})`);
      } catch (error) {
        console.error(`[WebSocket Broadcast] ❌ Ошибка при отправке клиенту:`, error);
      }
    } else {
      console.warn(`[WebSocket Broadcast] ⚠️ Клиент не готов (readyState: ${client.readyState})`);
    }
  });
  
  console.log(`[WebSocket Broadcast] Итого отправлено: ${sentCount} из ${clients.size} клиентов`);
};

app.locals.broadcast = broadcast;

// Инициализация сервисов
const companionBotService = new CompanionBotService();
companionBotService.init(chat3Client);

// Передаем сервис в app.locals для использования в контроллерах
app.locals.companionBotService = companionBotService;

const gigachatService = new GigaChatService();
if (config.gigachat.clientId && config.gigachat.clientSecret) {
  gigachatService.init(config.gigachat.clientId, config.gigachat.clientSecret, {
    model: config.gigachat.model,
    temperature: config.gigachat.temperature,
    maxTokens: config.gigachat.maxTokens,
    topP: config.gigachat.topP,
  });
  console.log('GigaChatService инициализирован');
} else {
  console.warn('GigaChat Client ID или Client Secret не настроены, генерация рекомендаций будет недоступна');
}

const fileService = new FileService();

// Инициализация RabbitMQ клиента для получения обновлений
const rabbitmqClient = new RabbitMQUpdatesClient();
rabbitmqClient.setBroadcastCallback(broadcast);
rabbitmqClient.setServices(companionBotService, gigachatService, fileService, chat3Client);

// Подключение к RabbitMQ и настройка очереди
(async () => {
  try {
    await rabbitmqClient.connect();
    await rabbitmqClient.setupQueue();
    console.log('RabbitMQ клиент настроен для получения обновлений менеджера');
  } catch (error) {
    console.error('Ошибка при настройке RabbitMQ клиента:', error);
    // Не останавливаем сервер, продолжаем работу без RabbitMQ
  }
})();

// Запуск сервера
server.listen(config.server.port, config.server.host, () => {
  console.log(`Manager Backend запущен на http://${config.server.host}:${config.server.port}`);
  console.log(`WebSocket сервер запущен на ws://${config.server.host}:${config.server.port}/ws`);
});

// Обработка завершения
process.on('SIGINT', async () => {
  console.log('Завершение работы сервера...');
  await rabbitmqClient.close();
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Завершение работы сервера...');
  await rabbitmqClient.close();
  wss.close();
  server.close();
  process.exit(0);
});
