import { ref, onMounted } from 'vue';
import { filesApi } from '../api/files.js';

export function useFiles() {
  const files = ref([]);
  const loading = ref(false);
  const error = ref(null);

  /**
   * Загрузить список файлов
   */
  const loadFiles = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await filesApi.getFiles();
      if (response.success) {
        files.value = response.data;
      } else {
        error.value = response.error || 'Ошибка при загрузке файлов';
      }
    } catch (err) {
      error.value = err.message || 'Ошибка при загрузке файлов';
      console.error('Ошибка при загрузке файлов:', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Загрузить файл
   */
  const uploadFile = async (file) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await filesApi.uploadFile(file);
      if (response.success) {
        await loadFiles(); // Обновляем список
        return response.data;
      } else {
        error.value = response.error || 'Ошибка при загрузке файла';
        throw new Error(error.value);
      }
    } catch (err) {
      error.value = err.message || 'Ошибка при загрузке файла';
      console.error('Ошибка при загрузке файла:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Загрузить файл в GigaChat
   */
  const uploadToGigaChat = async (fileId) => {
    error.value = null;
    try {
      const response = await filesApi.uploadToGigaChat(fileId);
      if (response.success) {
        await loadFiles(); // Обновляем список
        return response.data;
      } else {
        error.value = response.error || 'Ошибка при загрузке в GigaChat';
        throw new Error(error.value);
      }
    } catch (err) {
      error.value = err.message || 'Ошибка при загрузке в GigaChat';
      console.error('Ошибка при загрузке в GigaChat:', err);
      throw err;
    }
  };

  /**
   * Удалить файл из БД
   */
  const deleteFile = async (fileId) => {
    error.value = null;
    try {
      const response = await filesApi.deleteFile(fileId);
      if (response.success) {
        await loadFiles(); // Обновляем список
      } else {
        error.value = response.error || 'Ошибка при удалении файла';
        throw new Error(error.value);
      }
    } catch (err) {
      error.value = err.message || 'Ошибка при удалении файла';
      console.error('Ошибка при удалении файла:', err);
      throw err;
    }
  };

  /**
   * Удалить файл из GigaChat
   */
  const deleteFromGigaChat = async (fileId) => {
    error.value = null;
    try {
      const response = await filesApi.deleteFromGigaChat(fileId);
      if (response.success) {
        await loadFiles(); // Обновляем список
      } else {
        error.value = response.error || 'Ошибка при удалении из GigaChat';
        throw new Error(error.value);
      }
    } catch (err) {
      error.value = err.message || 'Ошибка при удалении из GigaChat';
      console.error('Ошибка при удалении из GigaChat:', err);
      throw err;
    }
  };

  // Загружаем файлы при монтировании
  onMounted(() => {
    loadFiles();
  });

  return {
    files,
    loading,
    error,
    loadFiles,
    uploadFile,
    uploadToGigaChat,
    deleteFile,
    deleteFromGigaChat
  };
}
