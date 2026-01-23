import { File, connectDatabase } from '@mms3-ask-bot/shared';

/**
 * Сервис для получения файлов для manager-backend
 */
export class FileService {
  /**
   * Получить все file_id загруженных файлов
   * @returns {Promise<Array<string>>}
   */
  async getAllUploadedFileIds() {
    try {
      // Убеждаемся, что БД подключена
      await connectDatabase();
      
      const files = await File.find({ 
        status: 'uploaded',
        fileId: { $exists: true, $ne: null }
      });
      
      const fileIds = files.map(file => file.fileId).filter(Boolean);
      console.log(`Получено ${fileIds.length} file_id для использования в запросах`);
      return fileIds;
    } catch (error) {
      console.error('Ошибка при получении file_id:', error);
      return [];
    }
  }
}
