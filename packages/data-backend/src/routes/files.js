import express from 'express';
import {
  getFiles,
  uploadFile,
  uploadToGigaChat,
  deleteFile,
  deleteFromGigaChat,
  getUploadedFileIds
} from '../controllers/filesController.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Получить список всех файлов
router.get('/', getFiles);

// Получить все file_id (для user-bot)
router.get('/uploaded-ids', getUploadedFileIds);

// Загрузить файл
router.post('/upload', upload.single('file'), uploadFile);

// Загрузить файл в GigaChat
router.post('/:id/upload-to-gigachat', uploadToGigaChat);

// Удалить файл из БД
router.delete('/:id', deleteFile);

// Удалить файл из GigaChat
router.delete('/:id/gigachat', deleteFromGigaChat);

export default router;
