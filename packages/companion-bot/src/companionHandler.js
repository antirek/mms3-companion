import { config } from './config.js';
import { FileService } from './services/fileService.js';

/**
 * Обработчик для бота-компаньона менеджера
 */
export class CompanionHandler {
  constructor() {
    this.chat3Client = null;
    this.managerService = null;
    this.aiClassifier = null;
  }

  /**
   * Инициализация обработчика
   * @param {Chat3UserBotClient} chat3Client - Клиент Chat3 API
   * @param {ManagerService} managerService - Сервис для работы с менеджером
   * @param {AIClassifier} aiClassifier - Классификатор AI
   */
  init(chat3Client, managerService, aiClassifier) {
    this.chat3Client = chat3Client;
    this.managerService = managerService;
    this.aiClassifier = aiClassifier;
    this.fileService = new FileService();
  }

  /**
   * Обработка сообщения от менеджера в диалоге с ботом-компаньоном
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  async handleManagerMessageToBot(update) {
    try {
      const { data } = update;
      
      if (!data || !data.message) {
        console.warn('Update не содержит данных сообщения');
        return { success: false, error: 'Отсутствуют данные сообщения' };
      }

      const message = data.message;
      const dialog = data.dialog;
      const eventType = update.eventType;

      // Обрабатываем только новые сообщения
      if (eventType !== 'message.create') {
        return { success: true, handled: false };
      }

      // Проверяем, что сообщение от менеджера
      if (!this.managerService.isManager(message.senderId)) {
        return { success: true, handled: false };
      }

      // Проверяем, что это диалог с ботом-компаньоном (по мета-тегу)
      const dialogMeta = dialog?.meta || {};
      const isCompanionBotDialog = dialogMeta.type === 'companion_bot' || 
                                    dialogMeta.type?.value === 'companion_bot';

      if (!isCompanionBotDialog) {
        return { success: true, handled: false };
      }

      console.log(`Обработка сообщения от менеджера в диалоге с ботом ${dialog.dialogId}:`, {
        messageId: message.messageId,
        senderId: message.senderId,
        content: message.content?.substring(0, 100),
      });

      // Получаем контекст диалога (последние N сообщений)
      const contextMessages = await this.getDialogContext(dialog.dialogId, 20);

      // Получаем все file_id загруженных файлов
      const fileIds = await this.fileService.getAllUploadedFileIds();
      console.log(`Используется ${fileIds.length} файлов для контекста`);

      // Генерируем ответ через GigaChat
      const response = await this.generateBotResponse(
        message.content,
        contextMessages,
        fileIds
      );

      if (!response.success) {
        console.error('Не удалось сгенерировать ответ:', response.error);
        return { success: false, error: response.error };
      }

      // Отправляем ответ от имени бота-компаньона
      const sendResult = await this.chat3Client.sendMessage(
        dialog.dialogId,
        response.text
      );

      if (!sendResult.success) {
        console.error('Не удалось отправить ответ:', sendResult.error);
        return { success: false, error: sendResult.error };
      }

      console.log(`Ответ отправлен в диалог с ботом-компаньоном: ${dialog.dialogId}`);
      return { success: true, handled: true, response: response.text };
    } catch (error) {
      console.error('Ошибка при обработке сообщения от менеджера:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Обработка входящего сообщения от клиента менеджеру
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  async handleClientMessage(update) {
    try {
      const { data } = update;
      
      if (!data || !data.message) {
        console.warn('Update не содержит данных сообщения');
        return { success: false, error: 'Отсутствуют данные сообщения' };
      }

      const message = data.message;
      const dialog = data.dialog;
      const eventType = update.eventType;

      // Обрабатываем только новые сообщения
      if (eventType !== 'message.create') {
        return { success: true, handled: false };
      }

      // Проверяем, что сообщение не от менеджера и не от бота
      if (this.managerService.isManager(message.senderId) || 
          this.managerService.isCompanionBot(message.senderId)) {
        return { success: true, handled: false };
      }

      // Проверяем, что это сообщение менеджеру (диалог содержит менеджера)
      // Получаем участников диалога для проверки
      const dialogMembers = await this.getDialogMembers(dialog.dialogId);
      const hasManager = dialogMembers.some(member => 
        this.managerService.isManager(member.userId)
      );

      if (!hasManager) {
        console.debug(`Диалог ${dialog.dialogId} не содержит менеджера, пропускаем`);
        return { success: true, handled: false };
      }

      console.log(`Обработка сообщения от клиента в диалоге ${dialog.dialogId}:`, {
        messageId: message.messageId,
        senderId: message.senderId,
        content: message.content?.substring(0, 100),
      });

      // Получаем информацию о клиенте
      const clientUserId = message.senderId;
      const clientName = message.senderInfo?.name || clientUserId;

      // Получаем или создаем диалог с ботом-компаньоном
      const companionDialogResult = await this.managerService.getOrCreateCompanionDialog(
        dialog.dialogId,
        clientUserId,
        clientName
      );

      if (!companionDialogResult.success) {
        console.error('Не удалось получить/создать диалог с ботом-компаньоном:', companionDialogResult.error);
        return { success: false, error: companionDialogResult.error };
      }

      const companionDialog = companionDialogResult.dialog;

      // Получаем контекст диалога (последние N сообщений)
      const contextMessages = await this.getDialogContext(dialog.dialogId, 10);

      // Получаем все file_id загруженных файлов
      const fileIds = await this.fileService.getAllUploadedFileIds();
      console.log(`Используется ${fileIds.length} файлов для контекста`);

      // Сначала отправляем сообщение клиента в диалог с ботом-компаньоном (для отображения)
      // Это поможет менеджеру видеть контекст в диалоге с ботом
      const clientMessageResult = await this.sendClientMessageToCompanionDialog(
        companionDialog.dialogId,
        message.content,
        clientName,
        dialog.dialogId,
        message.messageId
      );

      if (!clientMessageResult.success) {
        console.warn('Не удалось отправить сообщение клиента в диалог с ботом:', clientMessageResult.error);
        // Продолжаем обработку, даже если не удалось отправить сообщение клиента
      }

      // Генерируем подсказку через GigaChat
      const suggestion = await this.generateSuggestion(
        message.content,
        contextMessages,
        fileIds,
        clientName
      );

      if (!suggestion.success) {
        console.error('Не удалось сгенерировать подсказку:', suggestion.error);
        return { success: false, error: suggestion.error };
      }

      // Отправляем подсказку в диалог с ботом-компаньоном
      const sendResult = await this.sendSuggestion(
        companionDialog.dialogId,
        suggestion.text,
        dialog.dialogId,
        message.messageId,
        clientName
      );

      if (!sendResult.success) {
        console.error('Не удалось отправить подсказку:', sendResult.error);
        return { success: false, error: sendResult.error };
      }

      console.log(`Подсказка отправлена в диалог с ботом-компаньоном: ${companionDialog.dialogId}`);
      return { success: true, handled: true, suggestion: suggestion.text };
    } catch (error) {
      console.error('Ошибка при обработке сообщения от клиента:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Получить участников диалога
   * @param {string} dialogId - ID диалога
   * @returns {Promise<Array>}
   */
  async getDialogMembers(dialogId) {
    try {
      const result = await this.chat3Client.getDialogMembers(dialogId);
      return result.success ? result.data : [];
    } catch (error) {
      console.error(`Ошибка при получении участников диалога ${dialogId}:`, error);
      return [];
    }
  }

  /**
   * Получить контекст диалога (последние N сообщений)
   * @param {string} dialogId - ID диалога
   * @param {number} limit - Количество сообщений
   * @returns {Promise<Array>}
   */
  async getDialogContext(dialogId, limit = 10) {
    try {
      const result = await this.chat3Client.getDialogMessages(dialogId, limit, { createdAt: 1 });
      return result.success ? result.data : [];
    } catch (error) {
      console.error(`Ошибка при получении контекста диалога ${dialogId}:`, error);
      return [];
    }
  }

  /**
   * Генерация подсказки через GigaChat
   * @param {string} clientMessage - Сообщение клиента
   * @param {Array} contextMessages - Контекст диалога
   * @param {Array<string>} fileIds - Массив file_id
   * @param {string} clientName - Имя клиента
   * @returns {Promise<Object>}
   */
  async generateSuggestion(clientMessage, contextMessages, fileIds, clientName) {
    try {
      if (!this.aiClassifier) {
        throw new Error('AIClassifier не установлен');
      }

      // Формируем контекст диалога (только последние 5 сообщений для краткости)
      const recentContext = contextMessages.slice(-5);
      const contextText = recentContext.length > 0
        ? recentContext.map((msg, index) => {
            const sender = msg.senderId === this.managerService.getManagerUserId() 
              ? 'Менеджер' 
              : (msg.senderInfo?.name || msg.senderId);
            return `${sender}: ${msg.content || ''}`;
          }).join('\n')
        : 'Нет предыдущих сообщений';

      // Формируем userPrompt для генерации рекомендации + примеров
      const userPrompt = `ВАЖНО: Менеджеры пишут КОРОТКИЕ сообщения. Сформируй ответ в следующем формате:

**РЕКОМЕНДАЦИЯ:**
[Краткая рекомендация - 1-2 предложения о том, что ответить клиенту]

**ПРИМЕРЫ ОТВЕТОВ:**
1. [Первый готовый пример ответа - короткий, 2-3 предложения, можно скопировать и отправить]
2. [Второй готовый пример ответа - альтернативный вариант, короткий, 2-3 предложения]

Требования:
- Рекомендация: максимум 2 предложения
- Каждый пример: максимум 2-3 предложения (50-100 слов)
- Примеры должны быть готовыми к использованию (можно скопировать и отправить)
- Тон: профессиональный, но дружелюбный

Клиент ${clientName} написал: "${clientMessage}"

Контекст (последние сообщения):
${contextText}

Сформируй рекомендацию и примеры ответов для менеджера.`;

      // Генерируем подсказку
      // Передаем userPrompt с явным требованием краткости
      const result = await this.aiClassifier.classifyIntentWithFiles(
        userPrompt,
        [],
        [],
        fileIds
      );

      if (!result.success || !result.answer) {
        throw new Error('Не удалось получить подсказку от AI');
      }

      return {
        success: true,
        text: result.answer
      };
    } catch (error) {
      console.error('Ошибка при генерации подсказки:', error);
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }

  /**
   * Отправка сообщения клиента в диалог с ботом-компаньоном (для отображения контекста)
   * @param {string} companionDialogId - ID диалога с ботом
   * @param {string} clientMessage - Текст сообщения клиента
   * @param {string} clientName - Имя клиента
   * @param {string} clientDialogId - ID диалога с клиентом
   * @param {string} clientMessageId - ID сообщения клиента
   * @returns {Promise<Object>}
   */
  async sendClientMessageToCompanionDialog(companionDialogId, clientMessage, clientName, clientDialogId, clientMessageId) {
    try {
      // Отправляем сообщение от имени клиента (используем специальный формат для UI)
      const messageText = `📩 Сообщение от клиента ${clientName}:\n\n${clientMessage}`;

      // Отправляем сообщение от имени клиента (используем clientUserId как senderId)
      // Но для отображения в UI нам нужно использовать специальный тип сообщения
      // Пока отправляем от имени бота с мета-тегом, что это сообщение клиента
      const result = await this.chat3Client.sendMessage(
        companionDialogId,
        messageText
      );

      if (result.success && result.messageId) {
        // Сохраняем мета теги для идентификации сообщения клиента
        await this.chat3Client.setMessageMeta(result.messageId, 'isClientMessage', true);
        await this.chat3Client.setMessageMeta(result.messageId, 'relatedDialogId', clientDialogId);
        await this.chat3Client.setMessageMeta(result.messageId, 'relatedMessageId', clientMessageId);
        await this.chat3Client.setMessageMeta(result.messageId, 'clientName', clientName);
        await this.chat3Client.setMessageMeta(result.messageId, 'originalClientMessage', clientMessage);
      }

      return result;
    } catch (error) {
      console.error('Ошибка при отправке сообщения клиента в диалог с ботом:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Отправка подсказки в диалог с ботом-компаньоном
   * @param {string} companionDialogId - ID диалога с ботом
   * @param {string} suggestionText - Текст подсказки
   * @param {string} clientDialogId - ID диалога с клиентом
   * @param {string} clientMessageId - ID сообщения клиента
   * @param {string} clientName - Имя клиента
   * @returns {Promise<Object>}
   */
  async sendSuggestion(companionDialogId, suggestionText, clientDialogId, clientMessageId, clientName) {
    try {
      const companionBotUserId = this.managerService.getCompanionBotUserId();
      
      // Формируем текст сообщения с информацией о клиенте
      const messageText = `💡 Подсказка для ответа клиенту ${clientName}:\n\n${suggestionText}`;

      // Отправляем сообщение от имени бота-компаньона
      const result = await this.chat3Client.sendMessage(
        companionDialogId,
        messageText
      );

      if (result.success && result.messageId) {
        // Сохраняем мета теги для связи с диалогом клиента
        await this.chat3Client.setMessageMeta(result.messageId, 'relatedDialogId', clientDialogId);
        await this.chat3Client.setMessageMeta(result.messageId, 'relatedMessageId', clientMessageId);
        await this.chat3Client.setMessageMeta(result.messageId, 'clientName', clientName);
        await this.chat3Client.setMessageMeta(result.messageId, 'isSuggestion', true);
      }

      return result;
    } catch (error) {
      console.error('Ошибка при отправке подсказки:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Генерация ответа бота через GigaChat
   * @param {string} managerMessage - Сообщение менеджера
   * @param {Array} contextMessages - Контекст диалога
   * @param {Array<string>} fileIds - Массив file_id
   * @returns {Promise<Object>}
   */
  async generateBotResponse(managerMessage, contextMessages, fileIds) {
    try {
      if (!this.aiClassifier) {
        throw new Error('AIClassifier не установлен');
      }

      // Формируем промпт для генерации ответа
      const systemPrompt = `Ты - умный помощник менеджера. Твоя задача - отвечать на вопросы менеджера, используя контекст диалога и прикрепленные файлы с данными.

Правила:
1. Ответ должен быть точным и информативным
2. Используй профессиональный, но дружелюбный тон
3. Если в запросе недостаточно информации, предложи уточняющие вопросы
4. Учитывай контекст предыдущих сообщений в диалоге
5. Если есть прикрепленные файлы с данными, используй их для формирования ответа`;

      // Формируем контекст диалога
      const contextText = contextMessages.length > 0
        ? contextMessages.map((msg, index) => {
            const sender = this.managerService.isManager(msg.senderId)
              ? 'Менеджер' 
              : (this.managerService.isCompanionBot(msg.senderId) 
                  ? 'Бот-компаньон'
                  : (msg.senderInfo?.name || msg.senderId));
            return `${sender}: ${msg.content || ''}`;
          }).join('\n')
        : 'Нет предыдущих сообщений';

      const userPrompt = `Менеджер написал: "${managerMessage}"

Контекст диалога:
${contextText}

Ответь на вопрос менеджера, используя контекст и прикрепленные файлы.`;

      // Генерируем ответ
      const result = await this.aiClassifier.classifyIntentWithFiles(
        userPrompt,
        [],
        [],
        fileIds
      );

      if (!result.success || !result.answer) {
        throw new Error('Не удалось получить ответ от AI');
      }

      return {
        success: true,
        text: result.answer
      };
    } catch (error) {
      console.error('Ошибка при генерации ответа бота:', error);
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }
}
