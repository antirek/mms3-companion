import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_UPDATES_EXCHANGE || 'chat3_updates',
  },
  manager: {
    userId: process.env.MANAGER_USER_ID || 'manager_1',
    name: process.env.MANAGER_NAME || 'Manager',
  },
  companionBot: {
    userId: process.env.COMPANION_BOT_USER_ID || 'bot_companion',
    name: process.env.COMPANION_BOT_NAME || 'Бот-компаньон',
  },
  chat3: {
    // API URL: базовый URL сервера (библиотека chat3-client может добавлять /api автоматически)
    // Если библиотека не добавляет /api, укажите полный URL с /api в переменной окружения
    apiUrl: process.env.CHAT3_API_URL || 'http://localhost:3000/api',
    apiKey: process.env.CHAT3_API_KEY || '',
    tenantId: process.env.CHAT3_TENANT_ID || 'tnt_default',
  },
  gigachat: {
    clientId: process.env.GIGACHAT_CLIENT_ID || '',
    clientSecret: process.env.GIGACHAT_CLIENT_SECRET || '',
    model: process.env.GIGACHAT_MODEL || 'GigaChat-2',
    // Низкая температура для более точной и детерминированной классификации
    temperature: parseFloat(process.env.GIGACHAT_TEMPERATURE || '0.1'),
    // Увеличиваем количество токенов для формата "рекомендация + примеры" (500 токенов = ~350-400 слов)
    maxTokens: parseInt(process.env.GIGACHAT_MAX_TOKENS || '500', 10),
    // Top-p для более структурированных ответов (0.1 = более детерминированный)
    topP: parseFloat(process.env.GIGACHAT_TOP_P || '0.1'),
  },
};

