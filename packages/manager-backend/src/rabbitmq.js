import amqp from 'amqplib';
import { config } from './config.js';
import { CompanionBotService } from './services/companionBotService.js';
import { GigaChatService } from './services/gigachatService.js';
import { FileService } from './services/fileService.js';

/**
 * Клиент для получения обновлений из RabbitMQ для менеджера
 */
export class RabbitMQUpdatesClient {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.broadcastCallback = null;
    this.companionBotService = null;
    this.gigachatService = null;
    this.fileService = null;
    this.chat3Client = null;
  }

  /**
   * Установка сервисов
   * @param {CompanionBotService} companionBotService - Сервис для работы с ботом-компаньоном
   * @param {GigaChatService} gigachatService - Сервис для работы с GigaChat
   * @param {FileService} fileService - Сервис для работы с файлами
   * @param {Chat3Client} chat3Client - Клиент Chat3 API
   */
  setServices(companionBotService, gigachatService, fileService, chat3Client) {
    this.companionBotService = companionBotService;
    this.gigachatService = gigachatService;
    this.fileService = fileService;
    this.chat3Client = chat3Client;
  }

  /**
   * Установка callback для broadcast обновлений
   * @param {Function} callback - Функция для отправки обновлений через WebSocket
   */
  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  /**
   * Подключение к RabbitMQ
   */
  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      console.log(`Подключение к RabbitMQ: ${rabbitmqUrl}`);
      
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      // Обработка закрытия соединения
      this.connection.on('close', () => {
        console.warn('Соединение с RabbitMQ закрыто');
        this.isConnected = false;
      });

      this.connection.on('error', (err) => {
        console.error('Ошибка соединения с RabbitMQ:', err);
        this.isConnected = false;
      });

      console.log('Успешно подключено к RabbitMQ');
      return true;
    } catch (error) {
      console.error('Ошибка при подключении к RabbitMQ:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Настройка очереди и подписка на updates для менеджера
   */
  async setupQueue() {
    try {
      if (!this.channel) {
        throw new Error('Канал не создан. Сначала выполните connect()');
      }

      const exchange = process.env.RABBITMQ_UPDATES_EXCHANGE || 'chat3_updates';
      const managerUserId = config.manager.userId;
      const companionBotUserId = config.companionBot?.userId || 'bot_companion';

      // Имя очереди для менеджера
      const queue = `user_${managerUserId}_updates`;
      
      // Routing keys для подписки на updates менеджера и бота-компаньона
      // Подписываемся на все возможные варианты для надежности
      // Формат: update.{category}.{userType}.{userId}.{updateType}
      // ВАЖНО: Manager-backend должен получать ВСЕ updates для менеджера,
      // включая сообщения от клиентов в диалогах, где менеджер является участником
      const routingKeys = [
        // Updates для менеджера (все сообщения в диалогах, где менеджер является участником)
        // Это включает сообщения от клиентов, бота и самого менеджера
        `update.dialog.user.${managerUserId}.*`,      // Для user типа менеджера
        // Updates для бота-компаньона (чтобы видеть сообщения бота в диалогах с менеджером)
        // `update.dialog.bot.${companionBotUserId}.*`,   // Для bot типа бота-компаньона
      ];

      // Убеждаемся, что очередь существует
      await this.channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // TTL 1 час
        },
      });

      console.log(`Очередь '${queue}' настроена`);

      // Настраиваем exchange для updates chat3
      if (exchange) {
        await this.channel.assertExchange(exchange, 'topic', {
          durable: true,
        });

        // Привязываем очередь к exchange со всеми возможными routing keys
        for (const routingKey of routingKeys) {
          await this.channel.bindQueue(queue, exchange, routingKey);
        }
        console.log(`Exchange '${exchange}' настроен, очередь привязана к routing keys:`, routingKeys);
      }

      // Подписываемся на сообщения из очереди
      await this.channel.consume(
        queue,
        async (msg) => {
          if (msg !== null) {
            try {
              const content = JSON.parse(msg.content.toString());
              // Логируем ВСЕ Update для диагностики
              const logData = {
                eventType: content.eventType,
                userId: content.userId,
                entityId: content.entityId,
                dialogId: content.data?.dialog?.dialogId,
                messageId: content.data?.message?.messageId,
                senderId: content.data?.message?.senderId,
                content: content.data?.message?.content?.substring(0, 50),
                hasData: !!content.data,
                hasMessage: !!content.data?.message,
                hasDialog: !!content.data?.dialog
              };
              
              // Особое логирование для сообщений от клиентов в диалогах с менеджером
              if (content.eventType === 'message.create' && 
                  content.data?.message?.senderId && 
                  content.data?.message?.senderId !== config.manager.userId &&
                  content.data?.message?.senderId !== config.companionBot?.userId) {
                console.log('🔴 [КРИТИЧНО] Получен update для сообщения от клиента:', logData);
              } else {
                console.log('📥 Получен update из очереди для менеджера:', logData);
              }

              // Обрабатываем update
              await this.handleUpdate(content);

              // Подтверждаем обработку сообщения
              this.channel.ack(msg);
            } catch (error) {
              console.error('Ошибка при обработке update:', error);
              // Отклоняем некорректное сообщение без повторной отправки
              this.channel.nack(msg, false, false);
            }
          }
        },
        {
          noAck: false, // Требуем подтверждения обработки
        }
      );

      console.log(`Подписка на очередь '${queue}' установлена (routing keys: ${routingKeys.join(', ')})`);
    } catch (error) {
      console.error('Ошибка при настройке очереди:', error);
      throw error;
    }
  }

  /**
   * Обработка update из RabbitMQ
   * @param {Object} update - Update из RabbitMQ
   */
  async handleUpdate(update) {
    try {
      const { eventType, data, createdAt: updateCreatedAt } = update;

      // Логируем ВСЕ события для отладки
      console.log('🔍 [DEBUG] Получен update:', {
        eventType: eventType,
        hasData: !!data,
        hasMessage: !!data?.message,
        hasDialog: !!data?.dialog,
        dialogId: data?.dialog?.dialogId,
        messageId: data?.message?.messageId,
        senderId: data?.message?.senderId,
        content: data?.message?.content?.substring(0, 50)
      });

      // Обрабатываем события создания и обновления сообщений
      if ((eventType === 'message.create' || eventType === 'message.update') && data && data.message) {
        const message = data.message;
        const dialog = data.dialog;

        // Убеждаемся, что у сообщения есть createdAt
        // Проверяем разные возможные источники времени
        if (!message.createdAt) {
          // Пробуем найти время в других полях сообщения
          const timestamp = message.timestamp || 
                           message.created_at || 
                           message.created || 
                           message.time ||
                           (message._createdAt && typeof message._createdAt === 'number' ? message._createdAt : null);
          
          if (timestamp) {
            message.createdAt = timestamp;
          } else if (updateCreatedAt) {
            // Используем createdAt из самого события
            message.createdAt = updateCreatedAt;
          } else {
            // Если времени нет вообще, используем текущее время
            message.createdAt = Date.now();
            console.log('⚠️ [RabbitMQ] У сообщения нет createdAt, установлено текущее время');
          }
        }

        // Отправляем ВСЕ сообщения, которые относятся к диалогам менеджера
        // (включая сообщения от клиентов, бота-компаньона и самого менеджера)
        console.log(`Получено сообщение для менеджера (${eventType}):`, {
          dialogId: dialog?.dialogId,
          messageId: message.messageId,
          senderId: message.senderId,
          content: message.content?.substring(0, 50),
          eventType: eventType,
          hasDialog: !!dialog,
          hasMessage: !!message,
          hasCreatedAt: !!message.createdAt,
          createdAt: message.createdAt
        });

        // Проверяем, является ли сообщение от клиента (не от менеджера и не от бота)
        const isClientMessage = message.senderId !== config.manager.userId && 
                                message.senderId !== config.companionBot.userId;

        // Если сообщение от клиента и это создание (не обновление), обрабатываем его для генерации рекомендации
        if (eventType === 'message.create' && isClientMessage && this.companionBotService && this.gigachatService && this.fileService) {
          this.handleClientMessage(message, dialog).catch(error => {
            console.error('Ошибка при обработке сообщения от клиента:', error);
          });
        }

        // Отправляем обновление через WebSocket
        if (this.broadcastCallback) {
          const wsType = eventType === 'message.create' ? 'message.created' : 'message.updated';
          console.log(`Отправка сообщения через WebSocket (${wsType}):`, {
            dialogId: dialog?.dialogId,
            messageId: message.messageId,
            senderId: message.senderId
          });
          this.broadcastCallback({
            type: wsType,
            dialogId: dialog?.dialogId,
            message: message,
            dialog: dialog
          });
          console.log('Сообщение отправлено через WebSocket');
        } else {
          console.warn('broadcastCallback не установлен, сообщение не отправлено');
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке update:', error);
    }
  }

  /**
   * Обработка сообщения от клиента
   * @param {Object} message - Сообщение от клиента
   * @param {Object} dialog - Диалог
   */
  async handleClientMessage(message, dialog) {
    try {
      const clientUserId = message.senderId;
      const clientName = message.senderInfo?.name || clientUserId;
      const clientDialogId = dialog.dialogId;
      const clientMessageContent = message.content;

      console.log(`🤖 Обработка сообщения от клиента ${clientName} (${clientUserId}) в диалоге ${clientDialogId}`);

      // Сначала проверяем, есть ли companionBotDialogId в мета-тегах диалога
      let companionDialogId = null;
      const dialogMeta = dialog.meta || {};
      
      // Проверяем разные варианты хранения companionBotDialogId в мета-тегах
      companionDialogId = dialogMeta.companionBotDialogId?.value || 
                         dialogMeta.companionBotDialogId || 
                         null;

      if (companionDialogId) {
        console.log(`✅ Найден companionBotDialogId в мета-тегах диалога: ${companionDialogId}`);
        // Используем его напрямую, без дополнительных проверок
        // Если диалог не существует, это будет видно при попытке отправить сообщение
      }

      // Если companionBotDialogId не найден в мета-тегах или диалог не существует, получаем/создаем через сервис
      if (!companionDialogId) {
        console.log(`🔍 companionBotDialogId не найден в мета-тегах, получаем/создаем через сервис...`);
        const companionDialogResult = await this.companionBotService.getOrCreateCompanionDialog(
          clientDialogId,
          clientUserId,
          clientName
        );

        if (!companionDialogResult.success) {
          console.error('Не удалось получить/создать диалог с ботом-компаньоном:', companionDialogResult.error);
          return;
        }

        const companionDialog = companionDialogResult.dialog;
        companionDialogId = companionDialog.dialogId || companionDialog._id || companionDialog.id;
        console.log(`✅ Диалог с ботом-компаньоном получен/создан: ${companionDialogId}`);
      }

      // Получаем контекст диалога (последние 10 сообщений)
      let contextMessages = [];
      try {
        const messagesResult = await this.chat3Client.getDialogMessages(clientDialogId, {
          limit: 10,
          sort: '(createdAt,desc)'
        });
        // getDialogMessages может вернуть массив или объект с data
        if (Array.isArray(messagesResult)) {
          contextMessages = messagesResult;
        } else if (messagesResult && messagesResult.data) {
          contextMessages = Array.isArray(messagesResult.data) ? messagesResult.data : [];
        } else if (messagesResult && Array.isArray(messagesResult)) {
          contextMessages = messagesResult;
        }
        // Сортируем по createdAt по возрастанию для правильного контекста
        contextMessages = contextMessages.reverse();
      } catch (error) {
        console.warn('Не удалось получить контекст диалога:', error.message);
      }

      // Получаем все file_id загруженных файлов
      const fileIds = await this.fileService.getAllUploadedFileIds();
      console.log(`📎 Используется ${fileIds.length} файлов для контекста`);

      // Генерируем рекомендацию через GigaChat с повторными попытками
      console.log(`🤖 Генерация рекомендации для ответа клиенту...`);
      
      let suggestionResult = null;
      const maxRetries = 3;
      const retryDelay = 2000; // 2 секунды
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          suggestionResult = await this.gigachatService.generateSuggestion(
            clientMessageContent,
            contextMessages,
            fileIds,
            clientName,
            config.manager.userId
          );

          if (suggestionResult.success) {
            if (attempt > 1) {
              console.log(`✅ Рекомендация успешно сгенерирована с попытки ${attempt}`);
            }
            break;
          }

          // Проверяем, является ли ошибка временной (504, 502, 503, timeout)
          const errorMessage = suggestionResult.error?.message || String(suggestionResult.error || '');
          const statusCode = suggestionResult.error?.response?.status || suggestionResult.error?.status;
          const isTemporaryError = statusCode === 504 || statusCode === 502 || statusCode === 503 || 
                                  errorMessage.includes('timeout') || errorMessage.includes('Gateway Time-out');

          if (isTemporaryError && attempt < maxRetries) {
            console.warn(`⚠️ Временная ошибка при генерации рекомендации (попытка ${attempt}/${maxRetries}):`, {
              statusCode,
              error: errorMessage
            });
            console.log(`🔄 Повторная попытка через ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error(`❌ Не удалось сгенерировать рекомендацию после ${attempt} попыток:`, suggestionResult.error);
            return;
          }
        } catch (error) {
          const statusCode = error?.response?.status || error?.status;
          const isTemporaryError = statusCode === 504 || statusCode === 502 || statusCode === 503 || 
                                  error.message?.includes('timeout') || error.message?.includes('Gateway Time-out');

          if (isTemporaryError && attempt < maxRetries) {
            console.warn(`⚠️ Исключение при генерации рекомендации (попытка ${attempt}/${maxRetries}):`, error.message);
            console.log(`🔄 Повторная попытка через ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error(`❌ Критическая ошибка при генерации рекомендации после ${attempt} попыток:`, error);
            return;
          }
        }
      }

      if (!suggestionResult || !suggestionResult.success) {
        console.error('❌ Не удалось сгенерировать рекомендацию после всех попыток');
        return;
      }

      // Формируем сообщение с 3 секциями:
      // 1. Сообщение клиента (первые 200 символов)
      // 2. Рекомендация AI
      // 3. Примеры ответов
      const clientMessagePreview = clientMessageContent.length > 200
        ? clientMessageContent.substring(0, 200) + '...'
        : clientMessageContent;

      // Парсим ответ AI для извлечения рекомендации и примеров
      const aiResponse = suggestionResult.text || '';
      
      // Извлекаем рекомендацию
      const recommendationMatch = aiResponse.match(/\*\*РЕКОМЕНДАЦИЯ:\*\*\s*\n(.*?)(?=\*\*ПРИМЕРЫ|$)/s);
      const recommendation = recommendationMatch ? recommendationMatch[1].trim() : '';
      
      // Извлекаем примеры
      const examplesMatch = aiResponse.match(/\*\*ПРИМЕРЫ ОТВЕТОВ:\*\*\s*\n(.*?)$/s);
      let examples = [];
      if (examplesMatch) {
        const examplesText = examplesMatch[1];
        const examplePattern = /^\d+\.\s*(.+?)(?=\n\d+\.|$)/gms;
        let match;
        while ((match = examplePattern.exec(examplesText)) !== null) {
          const exampleText = match[1].trim();
          if (exampleText) {
            examples.push(exampleText);
          }
        }
      }

      // Проверяем, есть ли реальная рекомендация или примеры
      const hasValidRecommendation = recommendation && 
                                     recommendation !== 'нет рекомендации' && 
                                     recommendation.length > 0;
      const hasValidExamples = examples.length > 0;

      // Не отправляем сообщение, если нет ни рекомендации, ни примеров
      if (!hasValidRecommendation && !hasValidExamples) {
        console.log('⚠️ Пропускаем отправку сообщения: нет рекомендации и примеров');
        return;
      }

      // Формируем финальное сообщение с 3 секциями
      const messageParts = [
        `📩 Сообщение от клиента ${clientName}:`,
        clientMessagePreview,
        '',
        `💡 Рекомендация:`,
        recommendation || 'нет рекомендации',
        '',
        `📝 Примеры ответов:`
      ];

      // Добавляем примеры
      if (examples.length > 0) {
        examples.forEach((example, index) => {
          messageParts.push(`${index + 1}. ${example}`);
        });
      } else {
        messageParts.push('нет примеров');
      }

      const suggestionText = messageParts.join('\n');

      // Отправляем сообщение от имени бота в диалог менеджер-бот с мета-тегом
      const sendResult = await this.companionBotService.sendMessageFromBot(
        companionDialogId,
        suggestionText,
        { class: 'suggestion' } // Мета-тег для определения типа сообщения
      );

      if (!sendResult.success) {
        console.error('Не удалось отправить рекомендацию:', sendResult.error);
        return;
      }

      console.log(`✅ Рекомендация отправлена в диалог с ботом-компаньоном: ${companionDialogId}`);
    } catch (error) {
      console.error('Ошибка при обработке сообщения от клиента:', error);
    }
  }

  /**
   * Закрытие соединения
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        console.log('Канал закрыт');
      }

      if (this.connection) {
        await this.connection.close();
        console.log('Соединение с RabbitMQ закрыто');
      }

      this.isConnected = false;
    } catch (error) {
      console.error('Ошибка при закрытии соединения:', error);
      throw error;
    }
  }

  /**
   * Проверка состояния соединения
   */
  isReady() {
    return this.isConnected && this.channel !== null;
  }
}
