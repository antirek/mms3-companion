import { ref } from 'vue';
import { getCompanionMessages, getCompanionDialog } from '../api/companionBot.js';

export function useCompanionBot() {
  const companionMessages = ref([]);
  const companionDialogId = ref(null);
  const companionBotDialog = ref(null);
  const loading = ref(false);

  const loadCompanionMessages = async (clientDialogId) => {
    if (!clientDialogId) {
      companionMessages.value = [];
      return;
    }
    try {
      loading.value = true;
      
      // Загружаем сообщения
      const response = await getCompanionMessages(clientDialogId);
      if (response.success) {
        // Сортируем сообщения по createdAt по возрастанию (старые сверху, новые снизу)
        const messages = response.data || [];
        companionMessages.value = messages.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          
          // Нормализуем timestamp
          let normalizedA = 0;
          let normalizedB = 0;
          
          if (typeof timeA === 'number') {
            normalizedA = timeA > 1000000000000 ? timeA : timeA * 1000;
          } else if (typeof timeA === 'string') {
            // Пытаемся распарсить строку как число
            const numA = parseFloat(timeA);
            if (!isNaN(numA)) {
              normalizedA = numA > 1000000000000 ? numA : numA * 1000;
            } else {
              normalizedA = new Date(timeA).getTime() || 0;
            }
          }
          
          if (typeof timeB === 'number') {
            normalizedB = timeB > 1000000000000 ? timeB : timeB * 1000;
          } else if (typeof timeB === 'string') {
            // Пытаемся распарсить строку как число
            const numB = parseFloat(timeB);
            if (!isNaN(numB)) {
              normalizedB = numB > 1000000000000 ? numB : numB * 1000;
            } else {
              normalizedB = new Date(timeB).getTime() || 0;
            }
          }
          
          return normalizedA - normalizedB; // По возрастанию (старые первыми)
        });
      }
    } catch (error) {
      console.error('Ошибка при загрузке подсказок от бота:', error);
    } finally {
      loading.value = false;
    }
  };

  const loadCompanionBotDialog = async (clientDialogId) => {
    if (!clientDialogId) {
      companionBotDialog.value = null;
      companionDialogId.value = null;
      return;
    }
    try {
      const dialogResponse = await getCompanionDialog(clientDialogId);
      if (dialogResponse.success && dialogResponse.data) {
        companionBotDialog.value = dialogResponse.data;
        companionDialogId.value = dialogResponse.data.dialogId || 
                                   dialogResponse.data._id || 
                                   dialogResponse.data.id || 
                                   null;
      } else {
        companionBotDialog.value = null;
        companionDialogId.value = null;
      }
    } catch (error) {
      console.error('Ошибка при загрузке диалога бота-компаньона:', error);
      companionBotDialog.value = null;
      companionDialogId.value = null;
    }
  };

  const reloadMessages = async (clientDialogId) => {
    await loadCompanionMessages(clientDialogId);
  };

  return {
    companionMessages,
    companionDialogId,
    companionBotDialog,
    loading,
    loadCompanionMessages,
    loadCompanionBotDialog,
    reloadMessages
  };
}
