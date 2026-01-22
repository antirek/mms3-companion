import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

// Создаем директорию для загрузок, если её нет
const uploadDir = config.uploads.destination;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Фильтр файлов
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (config.uploads.allowedExtensions.includes(ext) && 
      config.uploads.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Разрешены только файлы .txt. Получен: ${ext}`), false);
  }
};

// Настройка multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.uploads.maxFileSize
  },
  fileFilter: fileFilter
});
