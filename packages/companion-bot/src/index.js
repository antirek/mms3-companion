import { RabbitMQUpdatesClient } from './rabbitmq.js';
import { config } from './config.js';
import { Chat3UserBotClient } from './chat3Client.js';
import { UpdateHandlers } from './updateHandlers.js';
import { AIClassifier } from './aiClassifier.js';
import { ManagerService } from './managerService.js';
import { CompanionHandler } from './companionHandler.js';

const bot = new RabbitMQUpdatesClient();
const chat3Client = new Chat3UserBotClient();
const aiClassifier = new AIClassifier();
const managerService = new ManagerService();
const companionHandler = new CompanionHandler();

// Обработка сигналов завершения
const shutdown = async (signal) => {
  console.log(`Получен сигнал ${signal}, завершение работы...`);
  try {
    await bot.close();
    console.log('Бот успешно остановлен');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при остановке бота:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  shutdown('uncaughtException');
});

// Основная функция запуска бота
async function start() {
  try {
    const { userId: companionBotUserId, name: companionBotName } = config.companionBot;
    const { userId: managerUserId, name: managerName } = config.manager;
    
    console.log(`Запуск companion-bot ${companionBotName} (userId: ${companionBotUserId})...`);
    console.log(`Менеджер: ${managerName} (userId: ${managerUserId})`);

    // Инициализируем Chat3 API клиент
    if (config.chat3.apiUrl && config.chat3.apiKey && config.chat3.tenantId) {
      chat3Client.init(config.chat3.apiUrl, config.chat3.apiKey, config.chat3.tenantId);
      UpdateHandlers.setChat3Client(chat3Client);

      // Создаем или получаем бота-компаньона
      const botResult = await chat3Client.ensureUser(companionBotUserId, companionBotName, 'bot');
      if (!botResult.success) {
        console.error('Не удалось создать/получить бота-компаньона:', botResult.error);
        process.exit(1);
      }
      
      if (botResult.created) {
        console.log(`Бот-компаньон ${companionBotUserId} создан в системе`);
      } else {
        console.log(`Бот-компаньон ${companionBotUserId} уже существует в системе`);
      }

      // Инициализируем ManagerService
      managerService.init(chat3Client);
      console.log('ManagerService инициализирован');

      // Инициализируем AIClassifier
      if (config.gigachat.clientId && config.gigachat.clientSecret) {
        aiClassifier.init(config.gigachat.clientId, config.gigachat.clientSecret, {
          model: config.gigachat.model,
          temperature: config.gigachat.temperature,
          maxTokens: config.gigachat.maxTokens,
          topP: config.gigachat.topP,
        });
        console.log('AIClassifier инициализирован');
      } else {
        console.warn('GigaChat Client ID или Client Secret не настроены, AI генерация подсказок будет недоступна');
      }

      // Инициализируем CompanionHandler
      companionHandler.init(chat3Client, managerService, aiClassifier);
      UpdateHandlers.setCompanionHandler(companionHandler);
      console.log('CompanionHandler инициализирован');
    } else {
      console.warn('Chat3 API URL, API Key или Tenant ID не настроены');
      process.exit(1);
    }

    // Подключаемся к RabbitMQ
    await bot.connect();

    // Настраиваем очередь для менеджера (подписываемся на обновления менеджера)
    await bot.setupQueueForUser(managerUserId);

    console.log('Companion-bot успешно запущен и готов к работе');
    console.log(`Ожидание updates для менеджера из очереди: user_${managerUserId}_updates`);

    // Периодическая проверка соединения
    setInterval(() => {
      if (!bot.isReady()) {
        console.warn('Соединение с RabbitMQ потеряно, попытка переподключения...');
        bot.connect()
          .then(() => bot.setupQueue())
          .catch((error) => console.error('Ошибка переподключения:', error));
      }
    }, 30000); // Проверка каждые 30 секунд

  } catch (error) {
    console.error('Критическая ошибка при запуске бота:', error);
    process.exit(1);
  }
}

// Запуск бота
start();

