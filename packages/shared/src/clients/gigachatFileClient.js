import { AuthClient, ApiClient } from '@mobilon-dev/gigachat-api-client';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Клиент для работы с файлами в GigaChat
 */
export class GigaChatFileClient {
  constructor() {
    this.authClient = null;
    this.apiClient = null;
    this.clientId = process.env.GIGACHAT_CLIENT_ID || '';
    this.clientSecret = process.env.GIGACHAT_CLIENT_SECRET || '';
    this.authUrl = process.env.GIGACHAT_AUTH_URL || 'https://gigachat-auth-proxy.services.mobilon.ru';
    this.apiUrl = process.env.GIGACHAT_API_URL || 'https://gigachat-service-proxy.services.mobilon.ru';
    this.jwtToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Инициализация клиента
   */
  init() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GigaChat Client ID и Client Secret обязательны');
    }

    this.authClient = new AuthClient(this.clientId, this.clientSecret, {
      debug: false,
      url: this.authUrl,
    });

    console.log('GigaChatFileClient инициализирован');
  }

  /**
   * Получить JWT токен
   * @returns {Promise<string>}
   */
  async getJWTToken() {
    try {
      // Проверяем, есть ли валидный токен
      if (this.jwtToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.jwtToken;
      }

      // Получаем новый токен
      const tokenData = await this.authClient.getToken('GIGACHAT_API_PERS');
      
      if (!tokenData || !tokenData.access_token) {
        throw new Error('Не удалось получить JWT токен от GigaChat');
      }

      this.jwtToken = tokenData.access_token;
      console.log('jwt', this.jwtToken);
      // Токены обычно действительны 30 минут, устанавливаем срок на 25 минут для безопасности
      this.tokenExpiresAt = Date.now() + (25 * 60 * 1000);

      // Инициализируем ApiClient с новым токеном
      // ApiClient использует axios с baseURL, поэтому передаем базовый URL
      // ApiClient сам добавит /api/v1 к путям (например, /api/v1/files)
      let baseUrl = this.apiUrl;
      // Убираем /api/v1 если есть в конце
      if (baseUrl.endsWith('/api/v1') || baseUrl.endsWith('/api/v1/')) {
        baseUrl = baseUrl.replace(/\/api\/v1\/?$/, '');
      }
      // Убираем /api/v1 если есть в середине
      if (baseUrl.includes('/api/v1/')) {
        baseUrl = baseUrl.split('/api/v1')[0];
      }
      // Убираем завершающий слэш
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // В рабочем примере URL: https://gigachat-service-proxy.services.mobilon.ru
      // ApiClient сделает запрос на: https://gigachat-service-proxy.services.mobilon.ru/api/v1/files
      console.log(`Инициализация ApiClient с baseURL: ${baseUrl}`);
      
      this.apiClient = new ApiClient(this.jwtToken, {
        debug: true, // Включаем debug для отладки
        url: baseUrl,
      });

      console.log('JWT токен GigaChat получен');
      return this.jwtToken;
    } catch (error) {
      console.error('Ошибка при получении JWT токена:', error);
      throw error;
    }
  }

  /**
   * Загрузить файл в GigaChat
   * @param {string} filePath - Путь к файлу
   * @param {string} filename - Имя файла
   * @returns {Promise<string>} file_id
   */
  async uploadFile(filePath, filename) {
    try {
      // Убеждаемся, что токен получен и apiClient инициализирован
      await this.getJWTToken();

      if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден: ${filePath}`);
      }

      if (!this.apiClient) {
        throw new Error('ApiClient не инициализирован');
      }

      // form-data в Node.js ожидает stream
      // ApiClient делает formData.append('file', file)
      // form-data может принять stream, но для имени файла нужны опции
      // Проверяем исходный код ApiClient - он делает просто append без опций
      // Значит нужно передать stream, а имя файла form-data возьмет из stream.path
      // Но stream.path будет полным путем, а нам нужно только имя файла
      // Решение: создать временный файл с нужным именем или использовать другой подход
      
      // Альтернатива: использовать Buffer с опциями через обертку
      // Но ApiClient передает напрямую, поэтому нужно создать объект-обертку
      const fileBuffer = fs.readFileSync(filePath);
      
      // Создаем объект, который имеет stream интерфейс и имя файла
      // form-data может работать с Buffer, но нужны опции для имени
      // Так как ApiClient не передает опции, создаем объект-обертку
      const { Readable } = await import('stream');
      const bufferStream = new Readable();
      bufferStream.push(fileBuffer);
      bufferStream.push(null); // Завершаем stream
      bufferStream.path = filename; // Устанавливаем имя файла
      
      console.log(`Загрузка файла ${filename} в GigaChat через ApiClient.uploadFile()...`);

      // Используем метод uploadFile из ApiClient
      // Передаем stream с установленным path (именем файла)
      const response = await this.apiClient.uploadFile(bufferStream);

      console.log(`Ответ от ApiClient.uploadFile:`, response);

      if (!response || !response.id) {
        console.error('Неверный ответ от GigaChat API:', response);
        throw new Error('Неверный ответ от GigaChat API');
      }

      console.log(`Файл ${filename} загружен в GigaChat, file_id: ${response.id}`);
      return response.id;
    } catch (error) {
      console.error(`Ошибка при загрузке файла ${filename}:`, error.message || error);
      if (error.response) {
        console.error(`Ошибка GigaChat API (${error.response.status}):`, error.response.data);
        throw new Error(`GigaChat API ошибка: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Удалить файл из GigaChat
   * @param {string} fileId - ID файла в GigaChat
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    try {
      await this.getJWTToken();

      await axios.delete(
        `${this.apiUrl}/files/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`
          }
        }
      );

      console.log(`Файл ${fileId} удален из GigaChat`);
    } catch (error) {
      console.error(`Ошибка при удалении файла ${fileId}:`, error.message || error);
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
      await this.getJWTToken();

      const response = await axios.get(
        `${this.apiUrl}/files/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Ошибка при получении информации о файле ${fileId}:`, error.message || error);
      throw error;
    }
  }

  /**
   * Отправить запрос к GigaChat с файлами
   * @param {string} model - Модель GigaChat
   * @param {Array} messages - Массив сообщений
   * @param {Array<string>} fileIds - Массив file_id
   * @param {Object} options - Опции запроса
   * @returns {Promise<Object>}
   */
  async sendRequestWithFiles(model, messages, fileIds = [], options = {}) {
    try {
      await this.getJWTToken();

      if (!this.apiClient) {
        throw new Error('ApiClient не инициализирован');
      }

      const requestOptions = {
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        max_tokens: options.maxTokens || 2000,
        attachments: fileIds
      };

      const response = await this.apiClient.sendRequest(model, messages, requestOptions);
      return response;
    } catch (error) {
      console.error('Ошибка при отправке запроса с файлами:', error.message || error);
      throw error;
    }
  }
}
