import { config } from '../config.js';
import { DialogMetaManager } from './dialogMetaManager.js';

/**
 * Сервис для работы с ботом-компаньоном
 */
export class CompanionBotService {
  constructor() {
    this.chat3Client = null;
    this.metaManager = null;
  }

  /**
   * Инициализация сервиса
   * @param {Chat3Client} chat3Client - Клиент Chat3 API
   */
  init(chat3Client) {
    this.chat3Client = chat3Client;
    this.metaManager = new DialogMetaManager();
    this.metaManager.setChat3Client(chat3Client);
  }

  /**
   * Проверка, является ли пользователь менеджером
   * @param {string} userId - ID пользователя
   * @returns {boolean}
   */
  isManager(userId) {
    return userId === config.manager.userId;
  }

  /**
   * Проверка, является ли пользователь ботом-компаньоном
   * @param {string} userId - ID пользователя
   * @returns {boolean}
   */
  isCompanionBot(userId) {
    return userId === config.companionBot.userId;
  }

  /**
   * Получить или создать диалог с ботом-компаньоном для диалога с клиентом
   * @param {string} clientDialogId - ID диалога с клиентом
   * @param {string} clientUserId - ID клиента (опционально, будет определен автоматически)
   * @param {string} clientName - Имя клиента (опционально, будет определено автоматически)
   * @returns {Promise<Object>}
   */
  async getOrCreateCompanionDialog(clientDialogId, clientUserId = null, clientName = null) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const managerUserId = config.manager.userId;
      const companionBotUserId = config.companionBot.userId;
      
      // Если clientUserId или clientName не переданы, получаем полную информацию о диалоге
      if (!clientUserId || !clientName) {
        console.log(`[COMPANION-BOT] Получение информации о диалоге ${clientDialogId} для определения клиента...`);
        const dialogResult = await this.chat3Client.getDialog(clientDialogId);
        const dialogData = dialogResult?.data || dialogResult;
        
        if (dialogData) {
          const members = dialogData.members || [];
          const client = members.find(member => 
            member.userId !== managerUserId && member.type !== 'bot'
          );
          
          if (client) {
            clientUserId = clientUserId || client.userId;
            clientName = clientName || client.name || client.userId;
            console.log(`[COMPANION-BOT] Определен клиент: ${clientUserId} (${clientName})`);
          } else {
            console.warn(`[COMPANION-BOT] ⚠️ Диалог ${clientDialogId} не содержит клиента среди участников`);
            // Используем fallback значения
            clientUserId = clientUserId || 'unknown_client';
            clientName = clientName || 'Unknown Client';
          }
        }
      }

      // Сначала проверяем мета-тег диалога с контактом на наличие ID диалога бота
      const companionDialogIdMeta = await this.metaManager.getDialogMetaKey(clientDialogId, 'companionBotDialogId');
      
      if (companionDialogIdMeta.success && companionDialogIdMeta.data) {
        const companionDialogId = companionDialogIdMeta.data;
        console.log(`Найден ID диалога с ботом в мета-теге диалога с контактом: ${companionDialogId}`);
        
        // Получаем диалог по ID
        try {
          const dialogResult = await this.chat3Client.getDialog(companionDialogId);
          if (dialogResult && (dialogResult.dialogId || dialogResult._id || dialogResult.id)) {
            const dialogId = dialogResult.dialogId || dialogResult._id || dialogResult.id;
            console.log(`Используем существующий диалог с ботом-компаньоном: ${dialogId}`);
            return { success: true, dialog: { ...dialogResult, dialogId }, created: false };
          }
        } catch (error) {
          console.warn(`Диалог ${companionDialogId} не найден, создаем новый:`, error.message);
          // Продолжаем создание нового диалога
        }
      }

      // Если мета-тега нет или диалог не найден, ищем по старому способу (для обратной совместимости)
      const filter = `(meta.clientDialogId,eq,${JSON.stringify(clientDialogId)})&(meta.type,eq,companion_bot)`;
      
      // Получаем диалоги менеджера
      const dialogsResult = await this.chat3Client.getUserDialogs(managerUserId, {
        filter: filter,
        limit: 1
      });

      const dialogs = dialogsResult.success ? dialogsResult.data : [];
      
      if (dialogs.length > 0) {
        const existingDialog = dialogs[0];
        console.log(`Найден существующий диалог с ботом-компаньоном для клиента ${clientUserId}: ${existingDialog.dialogId}`);
        
        // Сохраняем ID диалога бота в мета-тег диалога с контактом (если еще не сохранен)
        const existingDialogId = existingDialog.dialogId || existingDialog._id || existingDialog.id;
        const metaResult = await this.metaManager.setDialogMetaKey(clientDialogId, 'companionBotDialogId', existingDialogId);
        if (metaResult.success) {
          console.log(`ID диалога бота сохранен в мета-тег диалога с контактом: ${existingDialogId}`);
        } else {
          console.warn(`Не удалось сохранить мета-тег companionBotDialogId: ${metaResult.error}`);
        }
        
        return { success: true, dialog: existingDialog, created: false };
      }

      // Создаем новый диалог с ботом-компаньоном
      console.log(`Создание диалога с ботом-компаньоном для клиента ${clientUserId}...`);
      
      // Убеждаемся, что бот-компаньон существует
      // Chat3Client из chat3-client не имеет метода ensureUser, используем createUser напрямую
      try {
        // Пытаемся получить пользователя
        await this.chat3Client.getUser(companionBotUserId);
        console.log(`Пользователь ${companionBotUserId} уже существует`);
      } catch (error) {
        // Если пользователь не найден, создаем его
        if (error.response && error.response.status === 404) {
          try {
            await this.chat3Client.createUser({
              userId: companionBotUserId,
              name: config.companionBot.name,
              type: 'bot'
            });
            console.log(`Пользователь ${companionBotUserId} успешно создан`);
          } catch (createError) {
            console.warn(`Не удалось создать пользователя ${companionBotUserId}:`, createError.message);
            // Продолжаем, возможно пользователь уже создан
          }
        } else {
          console.warn(`Ошибка при проверке пользователя ${companionBotUserId}:`, error.message);
        }
      }

      // Создаем диалог
      console.log(`[COMPANION-BOT] Попытка создать диалог с параметрами:`, {
        name: `Бот-компаньон: ${clientName}`,
        createdBy: managerUserId,
        membersCount: 2,
        clientDialogId,
        clientUserId,
        clientName
      });
      
      const dialogResult = await this.chat3Client.createDialog({
        name: `Бот-компаньон: ${clientName}`,
        createdBy: managerUserId,
        members: [
          {
            userId: managerUserId,
            type: 'user',
            name: config.manager.name
          },
          {
            userId: companionBotUserId,
            type: 'bot',
            name: config.companionBot.name
          }
        ],
        meta: {
          type: 'companion_bot',
          clientDialogId: clientDialogId,
          clientUserId: clientUserId,
          clientName: clientName
        }
      });

      // Извлекаем диалог из результата (может быть в data или напрямую)
      const newDialog = dialogResult?.data || dialogResult;

      console.log(`[COMPANION-BOT] Результат создания диалога:`, {
        hasResult: !!dialogResult,
        hasData: !!dialogResult?.data,
        hasDialog: !!newDialog,
        dialogId: newDialog?.dialogId || newDialog?._id || newDialog?.id,
        resultKeys: dialogResult ? Object.keys(dialogResult) : [],
        dialogKeys: newDialog ? Object.keys(newDialog) : []
      });

      const companionDialogId = newDialog?.dialogId || newDialog?._id || newDialog?.id;
      if (!companionDialogId) {
        console.error(`[COMPANION-BOT] ❌ Не удалось получить ID созданного диалога. Структура результата:`, JSON.stringify(dialogResult, null, 2));
        throw new Error('Не удалось получить ID созданного диалога');
      }
      
      console.log(`[COMPANION-BOT] ✅ Диалог с ботом-компаньоном создан: ${companionDialogId} для клиентского диалога ${clientDialogId}`);
      
      // Сохраняем ID созданного диалога бота в мета-тег диалога с контактом
      console.log(`[COMPANION-BOT] Сохранение мета-тега companionBotDialogId для диалога ${clientDialogId}...`);
      const metaResult = await this.metaManager.setDialogMetaKey(clientDialogId, 'companionBotDialogId', companionDialogId);
      if (metaResult.success) {
        console.log(`[COMPANION-BOT] ✅ ID диалога бота сохранен в мета-тег диалога с контактом: ${companionDialogId}`);
      } else {
        console.error(`[COMPANION-BOT] ❌ Ошибка при сохранении мета-тега companionBotDialogId для ${clientDialogId}:`, metaResult.error);
        // Не бросаем ошибку, чтобы не прерывать процесс, но логируем
      }
      
      return { success: true, dialog: newDialog, created: true };
    } catch (error) {
      console.error('Ошибка при получении/создании диалога с ботом-компаньоном:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Отправить сообщение от имени бота-компаньона в диалог
   * @param {string} dialogId - ID диалога
   * @param {string} content - Содержимое сообщения
   * @param {Object} meta - Мета-теги для сообщения (опционально)
   * @returns {Promise<Object>}
   */
  async sendMessageFromBot(dialogId, content, meta = {}) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const companionBotUserId = config.companionBot.userId;

      // Отправляем сообщение от имени бота-компаньона
      const result = await this.chat3Client.createMessage(dialogId, {
        senderId: companionBotUserId,
        type: 'internal.text',
        content: content
      });

      const messageData = result?.data || result;
      const messageId = messageData?.messageId || messageData?._id || messageData?.id;

      // Устанавливаем мета-теги, если они указаны
      if (messageId && Object.keys(meta).length > 0) {
        try {
          // chat3Client - это экземпляр Chat3Client из @mobilon-dev/chat3-client
          // У него есть метод setMeta напрямую
          for (const [key, value] of Object.entries(meta)) {
            await this.chat3Client.setMeta('message', messageId, key, { value });
          }
          console.log(`Мета-теги установлены для сообщения ${messageId}:`, Object.keys(meta).join(', '));
        } catch (metaError) {
          console.warn(`Не удалось установить мета-теги для сообщения ${messageId}:`, metaError.message);
        }
      }

      console.log(`Сообщение от бота отправлено в диалог ${dialogId}: ${content?.substring(0, 50)}...`, messageId ? `(messageId: ${messageId})` : '');
      return { success: true, data: messageData, messageId: messageId };
    } catch (error) {
      console.error(`Ошибка при отправке сообщения от бота в диалог ${dialogId}:`, error);
      return { success: false, error: error.message || String(error) };
    }
  }
}
