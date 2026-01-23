import { ref, computed } from 'vue';
import { getManagerDialogs, getDialogMessages, sendMessage as sendMessageAPI } from '../api/manager.js';

export function useManagerChat() {
  const dialogs = ref([]);
  const activeDialogId = ref(null);
  const clientMessages = ref([]);
  const loading = ref(false);

  const activeDialog = computed(() => {
    return dialogs.value.find(d => d.dialogId === activeDialogId.value);
  });

  const loadDialogs = async () => {
    try {
      loading.value = true;
      const response = await getManagerDialogs();
      if (response.success) {
        dialogs.value = response.data;
      }
    } catch (error) {
      console.error('Ошибка при загрузке диалогов:', error);
    } finally {
      loading.value = false;
    }
  };

  const selectDialog = async (dialogId) => {
    activeDialogId.value = dialogId;
    await loadMessages(dialogId);
  };

  const loadMessages = async (dialogId) => {
    try {
      const response = await getDialogMessages(dialogId);
      if (response.success) {
        const messages = Array.isArray(response.data) ? response.data : [];
        clientMessages.value = [...messages].reverse();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (content) => {
    if (!activeDialogId.value) return;
    
    try {
      const response = await sendMessageAPI(activeDialogId.value, content);
      if (response.success) {
        // Добавляем сообщение в список
        clientMessages.value.push(response.data);
        // Перезагружаем сообщения
        await loadMessages(activeDialogId.value);
      }
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
    }
  };

  return {
    dialogs,
    activeDialogId,
    activeDialog,
    clientMessages,
    loading,
    loadDialogs,
    selectDialog,
    loadMessages,
    sendMessage
  };
}
