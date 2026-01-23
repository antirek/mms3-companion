import { ref } from 'vue';
import { getDialogMessages } from '../api/manager.js';

export function useCompanionBot() {
  const botMessages = ref([]);
  const botDialogId = ref(null);
  const loading = ref(false);

  /**
   * Загрузка сообщений из диалога с ботом-менеджером
   * @param {string} botDialogIdParam - ID диалога бот-менеджер (из meta.companionBotDialogId)
   */
  const loadBotMessages = async (botDialogIdParam) => {
    if (!botDialogIdParam) {
      botMessages.value = [];
      botDialogId.value = null;
      return;
    }
    
    botDialogId.value = botDialogIdParam;
    
    try {
      loading.value = true;
      const response = await getDialogMessages(botDialogIdParam);
      
      if (response.success) {
        const messages = response.data || [];
        botMessages.value = messages.sort((a, b) => {
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
        botMessages.value = [];
      }
    } catch (error) {
      console.error('Error loading bot messages:', error);
      botMessages.value = [];
    } finally {
      loading.value = false;
    }
  };

  return {
    botMessages,
    botDialogId,
    loading,
    loadBotMessages
  };
}
