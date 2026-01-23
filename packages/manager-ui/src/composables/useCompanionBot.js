import { ref } from 'vue';
import { getDialogMessages, sendMessage as sendMessageAPI } from '../api/manager.js';

export function useCompanionBot() {
  const companionMessages = ref([]);
  const companionDialogId = ref(null);
  const loading = ref(false);

  /**
   * Загрузка сообщений из диалога с ботом-компаньоном
   * @param {string} companionBotDialogId - ID диалога с ботом-компаньоном (из meta.companionBotDialogId)
   */
  const loadCompanionMessages = async (companionBotDialogId) => {
    if (!companionBotDialogId) {
      companionMessages.value = [];
      companionDialogId.value = null;
      return;
    }
    
    companionDialogId.value = companionBotDialogId;
    
    try {
      loading.value = true;
      const response = await getDialogMessages(companionBotDialogId);
      
      if (response.success) {
        const messages = response.data || [];
        companionMessages.value = messages.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          const normalizedA = typeof timeA === 'number' 
            ? (timeA > 1000000000000 ? timeA : timeA * 1000)
            : (typeof timeA === 'string' ? (parseFloat(timeA) || new Date(timeA).getTime() || 0) : 0);
          const normalizedB = typeof timeB === 'number'
            ? (timeB > 1000000000000 ? timeB : timeB * 1000)
            : (typeof timeB === 'string' ? (parseFloat(timeB) || new Date(timeB).getTime() || 0) : 0);
          return normalizedA - normalizedB;
        });
      } else {
        companionMessages.value = [];
      }
    } catch (error) {
      console.error('Error loading companion messages:', error);
      companionMessages.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Отправка сообщения в диалог с ботом-компаньоном
   * @param {string} companionBotDialogId - ID диалога с ботом
   * @param {string} content - Содержимое сообщения
   */
  const sendMessage = async (companionBotDialogId, content) => {
    if (!companionBotDialogId || !content) {
      return { success: false, error: 'companionBotDialogId и content обязательны' };
    }
    
    try {
      const response = await sendMessageAPI(companionBotDialogId, content);
      if (response.success) {
        await loadCompanionMessages(companionBotDialogId);
      }
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const reloadMessages = async (companionBotDialogId) => {
    await loadCompanionMessages(companionBotDialogId);
  };

  return {
    companionMessages,
    companionDialogId,
    loading,
    loadCompanionMessages,
    sendMessage,
    reloadMessages
  };
}
