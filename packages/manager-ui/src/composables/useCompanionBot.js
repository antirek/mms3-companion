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
        companionMessages.value = response.data.reverse() || [];
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
