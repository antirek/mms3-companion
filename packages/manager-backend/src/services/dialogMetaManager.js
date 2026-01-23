/**
 * Менеджер для работы с мета тегами диалогов и сообщений
 */
export class DialogMetaManager {
  constructor() {
    this.chat3Client = null;
  }

  /**
   * Установка клиента Chat3 API
   * @param {Chat3Client} client - Экземпляр клиента
   */
  setChat3Client(client) {
    this.chat3Client = client;
  }

  /**
   * Получить все мета теги диалога
   * @param {string} dialogId - ID диалога
   * @returns {Promise<Object>}
   */
  async getDialogMeta(dialogId) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      // Используем метод getMeta из chat3-client
      // GET /api/meta/dialog/:dialogId
      const response = await this.chat3Client.getMeta('dialog', dialogId);

      return { success: true, data: response?.data || response || {} };
    } catch (error) {
      console.error(`Ошибка при получении мета тегов диалога ${dialogId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Получить конкретный мета тег диалога
   * @param {string} dialogId - ID диалога
   * @param {string} key - Ключ мета тега
   * @returns {Promise<Object>}
   */
  async getDialogMetaKey(dialogId, key) {
    try {
      const allMeta = await this.getDialogMeta(dialogId);
      if (!allMeta.success) {
        return allMeta;
      }

      const value = allMeta.data?.[key];
      return { success: true, data: value };
    } catch (error) {
      console.error(`Ошибка при получении мета тега ${key} диалога ${dialogId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Установить мета тег диалога
   * @param {string} dialogId - ID диалога
   * @param {string} key - Ключ мета тега
   * @param {any} value - Значение мета тега
   * @returns {Promise<Object>}
   */
  async setDialogMetaKey(dialogId, key, value) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      // Получаем текущие мета теги
      const currentMeta = await this.getDialogMeta(dialogId);
      const meta = currentMeta.success ? (currentMeta.data || {}) : {};

      // Обновляем нужный ключ
      meta[key] = value;

      // Сохраняем обновленные мета теги
      // PUT /api/meta/dialog/:dialogId
      await this.chat3Client.setMeta('dialog', dialogId, meta);

      return { success: true };
    } catch (error) {
      console.error(`Ошибка при установке мета тега ${key} диалога ${dialogId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }
}
