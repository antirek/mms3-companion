import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL
});

export const filesApi = {
  /**
   * Получить список всех файлов
   */
  async getFiles() {
    const response = await api.get('/api/files');
    return response.data;
  },

  /**
   * Загрузить файл
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Загрузить файл в GigaChat
   */
  async uploadToGigaChat(fileId) {
    const response = await api.post(`/api/files/${fileId}/upload-to-gigachat`);
    return response.data;
  },

  /**
   * Удалить файл из БД
   */
  async deleteFile(fileId) {
    const response = await api.delete(`/api/files/${fileId}`);
    return response.data;
  },

  /**
   * Удалить файл из GigaChat
   */
  async deleteFromGigaChat(fileId) {
    const response = await api.delete(`/api/files/${fileId}/gigachat`);
    return response.data;
  }
};
