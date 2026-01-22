import { config } from './config.js';
import { DialogMetaManager } from './dialogMetaManager.js';

/**
 * Сервис для работы с менеджером
 */
export class ManagerService {
  constructor() {
    this.chat3Client = null;
    this.metaManager = null;
  }

  /**
   * Инициализация сервиса
   * @param {Chat3UserBotClient} chat3Client - Клиент Chat3 API
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
   * Получить ID менеджера
   * @returns {string}
   */
  getManagerUserId() {
    return config.manager.userId;
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
   * Получить ID бота-компаньона
   * @returns {string}
   */
  getCompanionBotUserId() {
    return config.companionBot.userId;
  }

  /**
   * Проверка, является ли сообщение от клиента менеджеру
   * @param {Object} message - Сообщение
   * @param {Object} dialog - Диалог
   * @returns {boolean}
   */
  isClientMessageToManager(message, dialog) {
    // Проверяем, что сообщение не от менеджера и не от бота
    if (this.isManager(message.senderId) || this.isCompanionBot(message.senderId)) {
      return false;
    }

    // Проверяем, что диалог содержит менеджера
    // Для этого нужно проверить участников диалога
    // Пока упрощенная проверка - если диалог существует, считаем что менеджер в нем
    return true;
  }

  /**
   * Получить или создать диалог с ботом-компаньоном для диалога с клиентом
   * @param {string} clientDialogId - ID диалога с клиентом
   * @param {string} clientUserId - ID клиента
   * @param {string} clientName - Имя клиента
   * @returns {Promise<Object>}
   */
  async getOrCreateCompanionDialog(clientDialogId, clientUserId, clientName) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const managerUserId = this.getManagerUserId();
      const companionBotUserId = this.getCompanionBotUserId();

      // Сначала проверяем мета-тег диалога с контактом на наличие ID диалога бота
      const companionDialogIdMeta = await this.metaManager.getDialogMetaKey(clientDialogId, 'companionBotDialogId');
      
      if (companionDialogIdMeta.success && companionDialogIdMeta.data) {
        const companionDialogId = companionDialogIdMeta.data;
        console.log(`Найден ID диалога с ботом в мета-теге диалога с контактом: ${companionDialogId}`);
        
        // Получаем диалог по ID
        try {
          const dialogResult = await this.chat3Client.getDialog(companionDialogId);
          if (dialogResult && (dialogResult.dialogId || dialogResult._id)) {
            const dialogId = dialogResult.dialogId || dialogResult._id;
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
      const botResult = await this.chat3Client.ensureUser(
        companionBotUserId,
        config.companionBot.name,
        'bot'
      );

      if (!botResult.success) {
        throw new Error(`Не удалось создать/получить бота-компаньона: ${botResult.error}`);
      }

      // Создаем диалог
      const client = this.chat3Client.getClient();
      const newDialog = await client.createDialog({
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

      const companionDialogId = newDialog.dialogId || newDialog._id || newDialog.id;
      console.log(`Диалог с ботом-компаньоном создан: ${companionDialogId}`);
      
      // Сохраняем ID созданного диалога бота в мета-тег диалога с контактом
      const metaResult = await this.metaManager.setDialogMetaKey(clientDialogId, 'companionBotDialogId', companionDialogId);
      if (metaResult.success) {
        console.log(`ID диалога бота сохранен в мета-тег диалога с контактом: ${companionDialogId}`);
      } else {
        console.error(`Ошибка при сохранении мета-тега companionBotDialogId: ${metaResult.error}`);
      }
      
      return { success: true, dialog: newDialog, created: true };
    } catch (error) {
      console.error('Ошибка при получении/создании диалога с ботом-компаньоном:', error);
      return { success: false, error: error.message || String(error) };
    }
  }
}
