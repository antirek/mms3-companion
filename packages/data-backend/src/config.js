import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.DATA_BACKEND_PORT || '3001', 10),
  host: process.env.DATA_BACKEND_HOST || 'localhost',
  uploads: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedMimeTypes: ['text/plain'],
    allowedExtensions: ['.txt'],
    destination: process.env.UPLOAD_DESTINATION || './uploads'
  }
};
