import { AuthClient, ApiClient } from '@mobilon-dev/gigachat-api-client';
import { GigaChatFileClient } from '../clients/gigachatFileClient.js';

/**
 * Общий сервис для работы с GigaChat AI
 * Используется в companion-bot и manager-backend
 */
export class GigaChatService {
  constructor() {
    this.authClient = null;
    this.apiClient = null;
    this.fileClient = null;
    this.clientId = null;
    this.clientSecret = null;
    this.model = null;
    this.temperature = null;
    this.maxTokens = null;
    this.topP = null;
    this.jwtToken = null;
    this.tokenExpiresAt = null;
    this.authUrl = null;
    this.apiUrl = null;
  }

  /**
   * Инициализация сервиса
   * @param {string} clientId - Client ID для GigaChat
   * @param {string} clientSecret - Client Secret для GigaChat
   * @param {Object} options - Опции (model, temperature, maxTokens, topP, authUrl, apiUrl)
   */
  init(clientId, clientSecret, options = {}) {
    try {
      if (!clientId || !clientSecret) {
        throw new Error('GigaChat Client ID и Client Secret обязательны');
      }

      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.model = options.model || 'GigaChat-2-Max';
      this.temperature = options.temperature ?? 0.1;
      this.maxTokens = options.maxTokens ?? 500;
      this.topP = options.topP ?? 0.1;
      this.authUrl = options.authUrl || 'https://gigachat-auth-proxy.services.mobilon.ru';
      this.apiUrl = options.apiUrl || 'https://gigachat-service-proxy.services.mobilon.ru';

      // Инициализируем AuthClient для получения JWT
      this.authClient = new AuthClient(clientId, clientSecret, { 
        debug: false,
        url: this.authUrl,
      });

      // Инициализируем GigaChatFileClient для работы с файлами
      this.fileClient = new GigaChatFileClient();
      this.fileClient.init();

      console.log('GigaChatService инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации GigaChatService:', error);
      throw error;
    }
  }

  /**
   * Получить JWT токен
   * @returns {Promise<string>}
   */
  async getJWTToken() {
    try {
      // Проверяем, не истек ли токен
      if (this.jwtToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.jwtToken;
      }

      // Получаем новый токен
      const tokenData = await this.authClient.getToken('GIGACHAT_API_PERS');
      
      if (!tokenData || !tokenData.access_token) {
        throw new Error('Не удалось получить JWT токен от GigaChat');
      }

      this.jwtToken = tokenData.access_token;
      
      // Устанавливаем время истечения (с запасом в 5 минут)
      const expiresIn = (tokenData.expires_in || 1800) * 1000; // в миллисекундах
      this.tokenExpiresAt = Date.now() + expiresIn - 300000; // минус 5 минут

      // Инициализируем ApiClient с новым токеном
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

      this.apiClient = new ApiClient(this.jwtToken, {
        debug: false,
        url: baseUrl,
      });

      return this.jwtToken;
    } catch (error) {
      console.error('Ошибка при получении JWT токена:', error);
      throw error;
    }
  }

  /**
   * Извлечь ответ из ответа API
   * @param {Object} response - Ответ от API
   * @returns {string}
   */
  extractAnswerFromResponse(response) {
    try {
      if (response?.choices && response.choices.length > 0) {
        const message = response.choices[0].message;
        if (message?.content) {
          return message.content;
        }
      }
      return null;
    } catch (error) {
      console.error('Ошибка при извлечении ответа:', error);
      return null;
    }
  }

  /**
   * Отправить запрос к GigaChat API
   * @param {Array} messages - Массив сообщений
   * @param {Array<string>} fileIds - Массив file_id для контекста
   * @param {Object} options - Опции запроса (temperature, topP, maxTokens)
   * @returns {Promise<Object>}
   */
  async sendRequest(messages, fileIds = [], options = {}) {
    try {
      if (!this.apiClient) {
        await this.getJWTToken();
      }

      // Формируем сообщение пользователя с attachments, если есть файлы
      const messagesWithAttachments = messages.map(msg => {
        if (msg.role === 'user' && fileIds && fileIds.length > 0) {
          return {
            ...msg,
            attachments: fileIds
          };
        }
        return msg;
      });

      // Параметры запроса
      const requestOptions = {
        temperature: options.temperature ?? this.temperature,
        top_p: options.topP ?? this.topP,
        max_tokens: options.maxTokens ?? this.maxTokens
      };

      // Отправляем запрос к GigaChat API
      const response = await this.apiClient.sendRequest(this.model, messagesWithAttachments, requestOptions);

      // Извлекаем ответ
      const answer = this.extractAnswerFromResponse(response);
      
      // Извлекаем данные о токенах и модели из response
      const usage = response?.usage || null;
      const model = response?.model || null;

      return {
        success: true,
        answer: answer,
        usage: usage,
        model: model,
        rawResponse: response
      };
    } catch (error) {
      console.error('Ошибка при отправке запроса к GigaChat:', error);
      
      // При ошибке аутентификации пытаемся обновить токен и повторить запрос
      if (error.message && (error.message.includes('401') || error.message.includes('token') || error.message.includes('auth'))) {
        console.log('Попытка обновить JWT токен и повторить запрос...');
        try {
          this.jwtToken = null;
          this.tokenExpiresAt = null;
          await this.getJWTToken();
          
          // Повторяем запрос
          const messagesWithAttachments = messages.map(msg => {
            if (msg.role === 'user' && fileIds && fileIds.length > 0) {
              return {
                ...msg,
                attachments: fileIds
              };
            }
            return msg;
          });
          
          const requestOptions = {
            temperature: options.temperature ?? this.temperature,
            top_p: options.topP ?? this.topP,
            max_tokens: options.maxTokens ?? this.maxTokens
          };
          
          const response = await this.apiClient.sendRequest(this.model, messagesWithAttachments, requestOptions);
          const answer = this.extractAnswerFromResponse(response);
          const usage = response?.usage || null;
          const model = response?.model || null;

          return {
            success: true,
            answer: answer,
            usage: usage,
            model: model,
            rawResponse: response
          };
        } catch (retryError) {
          console.error('Ошибка при повторной попытке запроса:', retryError);
          return {
            success: false,
            error: retryError.message || String(retryError)
          };
        }
      }

      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }

  /**
   * Генерация рекомендации для ответа клиенту
   * @param {string} clientMessage - Сообщение клиента
   * @param {Array} contextMessages - Контекст диалога
   * @param {Array<string>} fileIds - Массив file_id для контекста
   * @param {string} clientName - Имя клиента
   * @param {string} managerUserId - ID менеджера (для определения отправителя в контексте)
   * @returns {Promise<Object>}
   */
  async generateSuggestion(clientMessage, contextMessages = [], fileIds = [], clientName = 'Клиент', managerUserId = null) {
    try {
      // Формируем контекст диалога (только последние 5 сообщений для краткости)
      const recentContext = contextMessages.slice(-5);
      const contextText = recentContext.length > 0
        ? recentContext.map((msg) => {
            const sender = managerUserId && msg.senderId === managerUserId
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

      // Формируем массив сообщений для запроса
      const messages = [
        {
          role: 'user',
          content: userPrompt
        }
      ];

      // Отправляем запрос
      const result = await this.sendRequest(messages, fileIds, {
        temperature: this.temperature,
        topP: this.topP,
        maxTokens: this.maxTokens
      });

      if (!result.success || !result.answer) {
        return {
          success: false,
          error: result.error || 'Не удалось получить ответ от AI'
        };
      }

      if (result.usage) {
        console.log(`Использовано токенов: ${result.usage.total_tokens} (prompt: ${result.usage.prompt_tokens}, completion: ${result.usage.completion_tokens})`);
      }
      if (result.model) {
        console.log(`Модель: ${result.model}`);
      }

      return {
        success: true,
        text: result.answer,
        usage: result.usage,
        model: result.model
      };
    } catch (error) {
      console.error('Ошибка при генерации рекомендации:', error);
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }

  /**
   * Получить file client для работы с файлами
   * @returns {GigaChatFileClient}
   */
  getFileClient() {
    return this.fileClient;
  }
}
