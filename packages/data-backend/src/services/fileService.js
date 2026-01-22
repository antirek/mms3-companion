import { File } from '@mms3-ask-bot/shared';

/**
 * Сервис для работы с файлами в БД
 */
export class FileService {
  /**
   * Создать запись о файле
   * @param {Object} fileData - Данные файла
   * @returns {Promise<Object>}
   */
  async createFile(fileData) {
    try {
      const file = new File({
        filename: fileData.filename,
        originalName: fileData.originalName,
        size: fileData.size,
        mimeType: fileData.mimeType || 'text/plain',
        status: 'pending'
      });

      await file.save();
      console.log(`Файл создан в БД: ${file.filename}`);
      return file;
    } catch (error) {
      console.error('Ошибка при создании файла в БД:', error);
      throw error;
    }
  }

  /**
   * Получить все файлы
   * @returns {Promise<Array>}
   */
  async getAllFiles() {
    try {
      const files = await File.find().sort({ createdAt: -1 });
      return files;
    } catch (error) {
      console.error('Ошибка при получении файлов:', error);
      throw error;
    }
  }

  /**
   * Получить файл по ID
   * @param {string} id - ID файла
   * @returns {Promise<Object|null>}
   */
  async getFileById(id) {
    try {
      const file = await File.findById(id);
      return file;
    } catch (error) {
      console.error(`Ошибка при получении файла ${id}:`, error);
      throw error;
    }
  }

  /**
   * Получить файл по filename
   * @param {string} filename - Имя файла
   * @returns {Promise<Object|null>}
   */
  async getFileByFilename(filename) {
    try {
      const file = await File.findOne({ filename });
      return file;
    } catch (error) {
      console.error(`Ошибка при получении файла по имени ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Обновить статус файла
   * @param {string} id - ID файла
   * @param {string} status - Новый статус
   * @param {string} fileId - file_id из GigaChat (опционально)
   * @param {string} errorMessage - Сообщение об ошибке (опционально)
   * @returns {Promise<Object>}
   */
  async updateFileStatus(id, status, fileId = null, errorMessage = null) {
    try {
      const file = await File.findById(id);
      if (!file) {
        throw new Error(`Файл с ID ${id} не найден`);
      }

      file.status = status;
      if (fileId) {
        file.fileId = fileId;
        file.uploadedAt = new Date();
      }
      if (errorMessage) {
        file.errorMessage = errorMessage;
      } else {
        file.errorMessage = undefined;
      }

      await file.save();
      console.log(`Статус файла ${id} обновлен: ${status}`);
      return file;
    } catch (error) {
      console.error(`Ошибка при обновлении статуса файла ${id}:`, error);
      throw error;
    }
  }

  /**
   * Удалить файл из БД
   * @param {string} id - ID файла
   * @returns {Promise<void>}
   */
  async deleteFile(id) {
    try {
      const file = await File.findById(id);
      if (!file) {
        throw new Error(`Файл с ID ${id} не найден`);
      }

      await File.findByIdAndDelete(id);
      console.log(`Файл ${id} удален из БД`);
    } catch (error) {
      console.error(`Ошибка при удалении файла ${id}:`, error);
      throw error;
    }
  }

  /**
   * Получить все file_id загруженных файлов
   * @returns {Promise<Array<string>>}
   */
  async getAllUploadedFileIds() {
    try {
      const files = await File.find({ 
        status: 'uploaded',
        fileId: { $exists: true, $ne: null }
      });
      
      return files.map(file => file.fileId).filter(Boolean);
    } catch (error) {
      console.error('Ошибка при получении file_id:', error);
      throw error;
    }
  }
}
