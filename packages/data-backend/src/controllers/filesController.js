import { FileService } from '../services/fileService.js';
import { GigaChatService } from '../services/gigachatService.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const fileService = new FileService();
const gigachatService = new GigaChatService();

/**
 * Получить список всех файлов
 */
export async function getFiles(req, res) {
  try {
    const files = await fileService.getAllFiles();
    res.json({ success: true, data: files });
  } catch (error) {
    console.error('Ошибка при получении файлов:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Загрузить файл
 */
export async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    };

    const file = await fileService.createFile(fileData);
    res.json({ success: true, data: file });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Загрузить файл в GigaChat
 */
export async function uploadToGigaChat(req, res) {
  try {
    const { id } = req.params;
    const file = await fileService.getFileById(id);

    if (!file) {
      return res.status(404).json({ success: false, error: 'Файл не найден' });
    }

    // Обновляем статус на uploading
    await fileService.updateFileStatus(id, 'uploading');

    try {
      const filePath = path.join(config.uploads.destination, file.filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден на диске: ${filePath}`);
      }

      const fileId = await gigachatService.uploadFileToGigaChat(
        filePath,
        file.originalName
      );

      // Обновляем статус на uploaded
      await fileService.updateFileStatus(id, 'uploaded', fileId);
      
      const updatedFile = await fileService.getFileById(id);
      res.json({ success: true, data: updatedFile });
    } catch (error) {
      // Обновляем статус на error
      await fileService.updateFileStatus(id, 'error', null, error.message);
      
      const updatedFile = await fileService.getFileById(id);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        data: updatedFile
      });
    }
  } catch (error) {
    console.error('Ошибка при загрузке в GigaChat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Удалить файл из БД
 */
export async function deleteFile(req, res) {
  try {
    const { id } = req.params;
    const file = await fileService.getFileById(id);

    if (!file) {
      return res.status(404).json({ success: false, error: 'Файл не найден' });
    }

    // Удаляем файл с диска
    const filePath = path.join(config.uploads.destination, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Удаляем из БД
    await fileService.deleteFile(id);
    res.json({ success: true, message: 'Файл удален' });
  } catch (error) {
    console.error('Ошибка при удалении файла:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Удалить файл из GigaChat
 */
export async function deleteFromGigaChat(req, res) {
  try {
    const { id } = req.params;
    const file = await fileService.getFileById(id);

    if (!file) {
      return res.status(404).json({ success: false, error: 'Файл не найден' });
    }

    if (!file.fileId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Файл не загружен в GigaChat' 
      });
    }

    try {
      await gigachatService.deleteFileFromGigaChat(file.fileId);
      
      // Обновляем статус на pending
      await fileService.updateFileStatus(id, 'pending');
      
      const updatedFile = await fileService.getFileById(id);
      res.json({ success: true, data: updatedFile });
    } catch (error) {
      console.error('Ошибка при удалении из GigaChat:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } catch (error) {
    console.error('Ошибка при удалении из GigaChat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Получить все file_id для user-bot
 */
export async function getUploadedFileIds(req, res) {
  try {
    const fileIds = await fileService.getAllUploadedFileIds();
    res.json({ success: true, data: fileIds });
  } catch (error) {
    console.error('Ошибка при получении file_id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
