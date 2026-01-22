import { config } from './config.js';
import { AuthClient, ApiClient } from '@mobilon-dev/gigachat-api-client';
import { optimizeIntentsForPrompt, intentsToCompactJson } from './promptOptimizer.js';
import { GigaChatFileClient } from '@mms3-ask-bot/shared';

/**
 * Классификатор намерений через GigaChat AI
 */
export class AIClassifier {
  constructor() {
    this.authClient = null;
    this.apiClient = null;
    this.clientId = null;
    this.clientSecret = null;
    this.model = null;
    this.temperature = null;
    this.maxTokens = null;
    this.topP = null;
    this.jwtToken = null;
    this.tokenExpiresAt = null;
    this.fileClient = null;
  }

  /**
   * Инициализация клиента GigaChat
   * @param {string} clientId - Client ID для GigaChat
   * @param {string} clientSecret - Client Secret для GigaChat
   * @param {Object} options - Опции (model, temperature, maxTokens)
   */
  init(clientId, clientSecret, options = {}) {
    try {
      if (!clientId || !clientSecret) {
        throw new Error('GigaChat Client ID и Client Secret обязательны');
      }

      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.model = options.model || config.gigachat?.model || 'GigaChat-2-Max';
      // Низкая температура (0.1) для более точной классификации намерений
      this.temperature = options.temperature ?? (config.gigachat?.temperature ?? 0.1);
      this.maxTokens = options.maxTokens ?? (config.gigachat?.maxTokens ?? 1500);
      // Top-p для более структурированных ответов
      this.topP = options.topP ?? (config.gigachat?.topP ?? 0.1);

      // Инициализируем AuthClient для получения JWT
      this.authClient = new AuthClient(clientId, clientSecret, { 
        debug: true,
        url: 'https://gigachat-auth-proxy.services.mobilon.ru',
      });

      // Инициализируем FileClient для работы с файлами
      this.fileClient = new GigaChatFileClient();
      this.fileClient.init();
      
      console.log('AIClassifier инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации AIClassifier:', error);
      throw error;
    }
  }

  /**
   * Получить JWT токен (с кэшированием и обновлением при необходимости)
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
      // Токены обычно действительны 30 минут, устанавливаем срок на 25 минут для безопасности
      this.tokenExpiresAt = Date.now() + (25 * 60 * 1000);

      // Инициализируем ApiClient с новым токеном
      this.apiClient = new ApiClient(this.jwtToken, {
        debug: true,
        url: 'https://gigachat-service-proxy.services.mobilon.ru',
      });

      console.log('JWT токен GigaChat получен');
      return this.jwtToken;
    } catch (error) {
      console.error('Ошибка при получении JWT токена:', error);
      throw error;
    }
  }

  /**
   * Построение системного промпта
   * @returns {string}
   */
  buildSystemPrompt() {
    return `Ты - сотрудник компании. Отвечай на вопросы пользователей на основе данных, которые есть у тебя в прикрепленных файлах. Будь вежливым, профессиональным и точным в ответах.`;
  }

  /**
   * Построение пользовательского сообщения с контекстом
   * @param {string} userMessage - Текущее сообщение пользователя
   * @param {Array} contextMessages - История сообщений для контекста
   * @returns {string}
   */
  buildUserMessage(userMessage, contextMessages = []) {
    // Если нет контекста, возвращаем просто сообщение пользователя
    if (!contextMessages || contextMessages.length === 0) {
      return userMessage;
    }

    // Форматируем контекст диалога
    const contextLines = contextMessages.map((msg, index) => {
      const sender = msg.senderId || 'Пользователь';
      const content = msg.content || '';
      
      // Корректно обрабатываем timestamp
      let timestamp = '';
      if (msg.createdAt) {
        try {
          const date = new Date(msg.createdAt);
          if (!isNaN(date.getTime())) {
            timestamp = date.toLocaleString('ru-RU');
          }
        } catch (e) {
          // Игнорируем ошибки парсинга даты
        }
      }
      
      return `- ${sender}: "${content}"${timestamp ? ` (${timestamp})` : ''}`;
    });

    return `Контекст диалога:
${contextLines.join('\n')}

Текущий запрос: ${userMessage}`;
  }

  /**
   * Классификация намерения пользователя с файлами
   * @param {string} userMessage - Сообщение пользователя
   * @param {Array} contextMessages - История сообщений для контекста
   * @param {Array} intents - Список намерений (не используется, оставлен для обратной совместимости)
   * @param {Array<string>} fileIds - Массив file_id из GigaChat
   * @returns {Promise<Object>}
   */
  async classifyIntentWithFiles(userMessage, contextMessages = [], intents = [], fileIds = []) {
    try {
      if (!this.authClient) {
        throw new Error('GigaChat AuthClient не инициализирован');
      }

      // Получаем JWT токен (с автоматическим обновлением при необходимости)
      await this.getJWTToken();

      if (!this.apiClient) {
        throw new Error('GigaChat ApiClient не инициализирован');
      }

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserMessage(userMessage, contextMessages);
      
      // Формируем сообщение пользователя с attachments внутри сообщения
      const userMessageObj = {
        role: 'user',
        content: userPrompt
      };
      
      // Добавляем attachments в сообщение пользователя, если есть файлы
      if (fileIds && fileIds.length > 0) {
        userMessageObj.attachments = fileIds;
      }

      // Формируем сообщения для GigaChat API
      const messages = [
        { role: 'system', content: systemPrompt },
        userMessageObj
      ];

      // Параметры запроса
      const requestOptions = {
        temperature: this.temperature,
        top_p: this.topP,
        max_tokens: this.maxTokens
      };

      console.log(`Отправка запроса к GigaChat с ${fileIds.length} прикрепленными файлами:`, fileIds);
      console.log('Формат сообщения:', JSON.stringify(userMessageObj, null, 2));

      // Отправляем запрос к GigaChat API с файлами
      const response = await this.apiClient.sendRequest(this.model, messages, requestOptions);

      // Парсим ответ - берем content из choices[0].message.content
      const answer = this.extractAnswerFromResponse(response);
      
      // Извлекаем данные о токенах и модели из response
      const usage = response?.usage || null;
      const model = response?.model || null;
      
      console.log(`Ответ получен с использованием ${fileIds.length} файлов, длина ответа: ${answer ? answer.length : 0}`);
      if (usage) {
        console.log(`Использовано токенов: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`);
      }
      if (model) {
        console.log(`Модель: ${model}`);
      }
      
      // Возвращаем упрощенный формат ответа с данными о токенах и модели
      return {
        success: true,
        status: 'success',
        intent: 'default_intent',
        data: {},
        answer: answer || 'Не удалось получить ответ от AI',
        usage: usage, // Данные о токенах
        model: model  // Модель
      };
    } catch (error) {
      console.error('Ошибка при классификации намерения с файлами:', error);
      
      // При ошибке аутентификации пытаемся обновить токен и повторить запрос
      if (error.message && (error.message.includes('401') || error.message.includes('token') || error.message.includes('auth'))) {
        console.log('Попытка обновить JWT токен и повторить запрос...');
        try {
          this.jwtToken = null;
          this.tokenExpiresAt = null;
          await this.getJWTToken();
          
          // Повторяем запрос
          const systemPrompt = this.buildSystemPrompt();
          const userPrompt = this.buildUserMessage(userMessage, contextMessages);
          const userMessageObj = {
            role: 'user',
            content: userPrompt
          };
          if (fileIds && fileIds.length > 0) {
            userMessageObj.attachments = fileIds;
          }
          const messages = [
            { role: 'system', content: systemPrompt },
            userMessageObj
          ];
          const requestOptions = {
            temperature: this.temperature,
            top_p: this.topP,
            max_tokens: this.maxTokens
          };
          console.log(`Повторная отправка запроса к GigaChat с ${fileIds.length} прикрепленными файлами:`, fileIds);
          const response = await this.apiClient.sendRequest(this.model, messages, requestOptions);
          const answer = this.extractAnswerFromResponse(response);
          const usage = response?.usage || null;
          const model = response?.model || null;
          return {
            success: true,
            status: 'success',
            intent: 'default_intent',
            data: {},
            answer: answer || 'Не удалось получить ответ от AI',
            usage: usage,
            model: model
          };
        } catch (retryError) {
          console.error('Ошибка при повторной попытке:', retryError);
        }
      }

      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: {},
        answer: 'Извините, произошла ошибка при обработке вашего запроса.',
        error: error.message || String(error)
      };
    }
  }

  /**
   * Классификация намерения пользователя (старый метод для обратной совместимости)
   * @param {string} userMessage - Сообщение пользователя
   * @param {Array} contextMessages - История сообщений для контекста
   * @param {Array} intents - Список намерений
   * @returns {Promise<Object>}
   */
  async classifyIntent(userMessage, contextMessages = [], intents = []) {
    return this.classifyIntentWithFiles(userMessage, contextMessages, intents, []);
    try {
      if (!this.authClient) {
        throw new Error('GigaChat AuthClient не инициализирован');
      }

      // Получаем JWT токен (с автоматическим обновлением при необходимости)
      await this.getJWTToken();

      if (!this.apiClient) {
        throw new Error('GigaChat ApiClient не инициализирован');
      }

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserMessage(userMessage, contextMessages);

      // Формируем сообщения для GigaChat API
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      // Параметры запроса
      const requestOptions = {
        temperature: this.temperature,
        top_p: this.topP,
        max_tokens: this.maxTokens,
      };

      // Отправляем запрос к GigaChat API
      const response = await this.apiClient.sendRequest(this.model, messages, requestOptions);

      // Извлекаем ответ
      const answer = this.extractAnswerFromResponse(response);
      return {
        success: true,
        status: 'success',
        intent: 'default_intent',
        data: {},
        answer: answer || 'Не удалось получить ответ от AI'
      };
    } catch (error) {
      console.error('Ошибка при классификации намерения:', error);
      
      // При ошибке аутентификации пытаемся обновить токен и повторить запрос
      if (error.message && (error.message.includes('401') || error.message.includes('token') || error.message.includes('auth'))) {
        console.log('Попытка обновить JWT токен и повторить запрос...');
        try {
          this.jwtToken = null;
          this.tokenExpiresAt = null;
          await this.getJWTToken();
          
          // Повторяем запрос
          const systemPrompt = this.buildSystemPrompt();
          const userPrompt = this.buildUserMessage(userMessage, contextMessages);
          const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ];
          const requestOptions = {
            temperature: this.temperature,
            top_p: this.topP,
            max_tokens: this.maxTokens,
          };
          const response = await this.apiClient.sendRequest(this.model, messages, requestOptions);
          const answer = this.extractAnswerFromResponse(response);
          return {
            success: true,
            status: 'success',
            intent: 'default_intent',
            data: {},
            answer: answer || 'Не удалось получить ответ от AI'
          };
        } catch (retryError) {
          console.error('Ошибка при повторной попытке:', retryError);
        }
      }

      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: {},
        answer: 'Извините, произошла ошибка при обработке вашего запроса.',
        error: error.message || String(error)
      };
    }
  }

  /**
   * Извлечь ответ из ответа GigaChat API
   * @param {Object} response - Ответ от GigaChat API
   * @returns {string}
   */
  extractAnswerFromResponse(response) {
    try {
      // Формат: choices[0].message.content
      if (response.choices && response.choices[0] && response.choices[0].message) {
        return response.choices[0].message.content || '';
      }
      
      // Альтернативный формат: choices[0].text
      if (response.choices && response.choices[0] && response.choices[0].text) {
        return response.choices[0].text;
      }
      
      // Прямой формат: content
      if (response.content) {
        return response.content;
      }
      
      // Формат: message
      if (response.message) {
        return response.message;
      }
      
      console.warn('Неизвестный формат ответа от GigaChat:', JSON.stringify(response, null, 2));
      return '';
    } catch (error) {
      console.error('Ошибка при извлечении ответа:', error);
      return '';
    }
  }

  /**
   * Парсинг ответа AI (JSON) - оставлен для обратной совместимости
   * @param {Object|string} response - Ответ от AI
   * @returns {Promise<Object>}
   */
  async parseAIResponse(response) {
    try {
      let jsonData;

      // Обрабатываем разные форматы ответа от GigaChat API
      if (typeof response === 'string') {
        // Если ответ - строка, пытаемся распарсить JSON
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.choices && response.choices[0] && response.choices[0].message) {
        // Формат OpenAI-style (choices[0].message.content)
        const content = response.choices[0].message.content;
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.choices && response.choices[0] && response.choices[0].text) {
        // Альтернативный формат (choices[0].text)
        const content = response.choices[0].text;
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.content) {
        // Прямой формат с content
        const cleaned = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.message) {
        // Формат с message
        const cleaned = response.message.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.data) {
        // Формат с data
        jsonData = response.data;
      } else {
        // Уже объект или другой формат
        jsonData = response;
      }

      // Валидация ответа
      const validated = this.validateIntentResponse(jsonData);
      return validated;
    } catch (error) {
      console.error('Ошибка при парсинге ответа AI:', error);
      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: { comment: 'Ошибка при обработке ответа AI' },
        error: error.message || String(error)
      };
    }
  }

  /**
   * Валидация ответа классификации
   * @param {Object} response - Ответ от AI
   * @returns {Object}
   */
  validateIntentResponse(response) {
    // Проверяем обязательные поля
    if (!response.status || !response.intent) {
      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: { comment: 'Некорректный формат ответа AI' },
        error: 'Отсутствуют обязательные поля status или intent'
      };
    }

    // Проверяем валидность статуса
    const validStatuses = ['success', 'insufficient_data', 'unknown_intent'];
    if (!validStatuses.includes(response.status)) {
      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: { comment: 'Некорректный статус ответа' },
        error: `Неизвестный статус: ${response.status}`
      };
    }

    // Проверяем наличие data
    if (!response.data || typeof response.data !== 'object') {
      response.data = {};
    }

    // Если insufficient_data, проверяем наличие missing_required_fields
    if (response.status === 'insufficient_data') {
      if (!Array.isArray(response.data.missing_required_fields)) {
        response.data.missing_required_fields = [];
      }
    }

    return {
      success: true,
      status: response.status,
      intent: response.intent,
      data: response.data
    };
  }
}

