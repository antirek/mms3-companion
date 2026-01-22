import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  server: {
    port: parseInt(process.env.MANAGER_BACKEND_PORT || '3002', 10),
    host: process.env.MANAGER_BACKEND_HOST || 'localhost',
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
    apiUrl: process.env.CHAT3_API_URL || 'http://localhost:3000/api',
    apiKey: process.env.CHAT3_API_KEY || '',
    tenantId: process.env.CHAT3_TENANT_ID || 'tnt_default',
  },
  websocket: {
    port: parseInt(process.env.MANAGER_WEBSOCKET_PORT || '3004', 10),
  },
};
