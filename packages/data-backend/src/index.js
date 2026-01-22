import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from '@mms3-ask-bot/shared';
import { config } from './config.js';
import filesRouter from './routes/files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/files', filesRouter);

// Статика для data-ui build
const staticPath = path.join(__dirname, '..', 'public');
app.use(express.static(staticPath));

// Fallback для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Подключение к MongoDB
connectDatabase()
  .then(() => {
    // Запуск сервера
    app.listen(config.port, config.host, () => {
      console.log(`Data Backend запущен на http://${config.host}:${config.port}`);
    });
  })
  .catch((error) => {
    console.error('Ошибка при запуске сервера:', error);
    process.exit(1);
  });

// Обработка завершения
process.on('SIGINT', async () => {
  console.log('Завершение работы сервера...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Завершение работы сервера...');
  process.exit(0);
});
