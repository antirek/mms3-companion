import { GigaChatFileClient } from '@mms3-ask-bot/shared';
import path from 'path';

/**
 * Сервис для работы с GigaChat
 */
export class GigaChatService {
  constructor() {
    this.client = null;
  }

  /**
   * Получить клиент (ленивая инициализация)
   */
  getClient() {
    if (!this.client) {
      this.client = new GigaChatFileClient();
      this.client.init();
    }
    return this.client;
  }

  /**
   * Загрузить файл в GigaChat
   * @param {string} filePath - Путь к файлу
   * @param {string} filename - Имя файла
   * @returns {Promise<string>} file_id
   */
  async uploadFileToGigaChat(filePath, filename) {
    try {
      const client = this.getClient();
      const fileId = await client.uploadFile(filePath, filename);
      return fileId;
    } catch (error) {
      console.error(`Ошибка при загрузке файла в GigaChat:`, error);
      throw error;
    }
  }

  /**
   * Удалить файл из GigaChat
   * @param {string} fileId - ID файла в GigaChat
   * @returns {Promise<void>}
   */
  async deleteFileFromGigaChat(fileId) {
    try {
      const client = this.getClient();
      await client.deleteFile(fileId);
    } catch (error) {
      console.error(`Ошибка при удалении файла из GigaChat:`, error);
      throw error;
    }
  }

  /**
   * Получить информацию о файле
   * @param {string} fileId - ID файла в GigaChat
   * @returns {Promise<Object>}
   */
  async getFileInfo(fileId) {
    try {
      const client = this.getClient();
      const info = await client.getFileInfo(fileId);
      return info;
    } catch (error) {
      console.error(`Ошибка при получении информации о файле:`, error);
      throw error;
    }
  }
}
