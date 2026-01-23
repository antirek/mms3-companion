<template>
  <div class="app">
    <header class="header">
      <h1>Чаты</h1>
    </header>
    <main class="main">
      <div class="column dialog-list">
        <h2>Список диалогов с клиентами</h2>
        <DialogList 
          :dialogs="dialogs" 
          :active-dialog-id="activeDialogId"
          @select-dialog="handleSelectDialog"
        />
      </div>
      <div class="column client-chat">
        <ClientChat 
          v-if="activeDialog"
          ref="clientChatRef"
          :dialog="activeDialog"
          :messages="clientMessages"
          :manager-user-id="managerUserId"
          @send-message="handleSendMessage"
        />
        <div v-else class="empty-state">
          <p>Выберите диалог для просмотра</p>
        </div>
      </div>
      <div class="column companion-bot-chat">
        <CompanionBotChat 
          v-if="activeDialog"
          :key="`companion-${activeDialogId}-${companionMessages.length}`"
          :client-dialog-id="activeDialogId"
          :messages="companionMessages"
          :companion-dialog-id="companionDialogId"
          :manager-user-id="managerUserId"
          @use-suggestion="handleUseSuggestion"
          @message-sent="handleCompanionMessageSent"
        />
        <div v-else class="empty-state">
          <p>Подсказки от бота-компаньона появятся здесь</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { useManagerChat } from './composables/useManagerChat.js';
import { useCompanionBot } from './composables/useCompanionBot.js';
import { useWebSocket } from './composables/useWebSocket.js';
import DialogList from './components/DialogList.vue';
import ClientChat from './components/ClientChat.vue';
import CompanionBotChat from './components/CompanionBotChat.vue';

const {
  dialogs,
  activeDialogId,
  activeDialog,
  clientMessages,
  loadDialogs,
  selectDialog,
  loadMessages,
  sendMessage
} = useManagerChat();

// ID менеджера (можно вынести в конфигурацию)
const managerUserId = ref('carl');

// Ref для компонента ClientChat
const clientChatRef = ref(null);

const {
  companionMessages,
  companionDialogId,
  loadCompanionMessages,
  reloadMessages
} = useCompanionBot();

// Обработчик сообщений через WebSocket
const handleWebSocketMessage = async (data) => {
  if ((data.type !== 'message.created' && data.type !== 'message.updated') || !data.message || !data.dialogId) {
    return;
  }

  const message = data.message;
  const dialogId = data.dialogId;
  const isUpdate = data.type === 'message.updated';
  const messageId = message.messageId || message._id || message.id;
  const isClientDialog = dialogId === activeDialogId.value;
  
  // Проверяем companionDialogId из мета-тегов активного диалога, если он не установлен
  let currentCompanionDialogId = companionDialogId.value;
  if (!currentCompanionDialogId && activeDialog.value) {
    currentCompanionDialogId = activeDialog.value.meta?.companionBotDialogId?.value || 
                               activeDialog.value.meta?.companionBotDialogId;
  }
  const isCompanionDialog = dialogId === currentCompanionDialogId;

  if (!isClientDialog && !isCompanionDialog) {
    loadDialogs();
    return;
  }

  // Обработка сообщения в диалоге с клиентом
  if (isClientDialog) {
    const existingIndex = clientMessages.value.findIndex(m => 
      (m.messageId || m._id || m.id) === messageId
    );
    
    if (isUpdate && existingIndex !== -1) {
      clientMessages.value[existingIndex] = message;
      clientMessages.value = [...clientMessages.value];
    } else if (!isUpdate && existingIndex === -1) {
      clientMessages.value = [...clientMessages.value, message];
      await nextTick();
      if (companionDialogId.value) {
        loadCompanionMessages(companionDialogId.value);
      }
    }
  }

  // Обработка сообщения в диалоге с ботом-компаньоном
  if (isCompanionDialog) {
    // Устанавливаем companionDialogId, если он еще не установлен
    if (!companionDialogId.value && currentCompanionDialogId) {
      companionDialogId.value = currentCompanionDialogId;
    }
    
    const existingIndex = companionMessages.value.findIndex(m => 
      (m.messageId || m._id || m.id) === messageId
    );
    
    if (isUpdate && existingIndex !== -1) {
      companionMessages.value[existingIndex] = message;
      companionMessages.value = [...companionMessages.value];
    } else if (!isUpdate && existingIndex === -1) {
      const newMessages = [...companionMessages.value, message];
      newMessages.sort((a, b) => {
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
      companionMessages.value = newMessages;
      await nextTick();
    }
  }
  
  loadDialogs();
};

// Подключаемся к WebSocket
useWebSocket(handleWebSocketMessage);

// Загружаем диалоги при монтировании
onMounted(() => {
  loadDialogs();
});

// При изменении активного диалога загружаем сообщения
watch(activeDialogId, (newDialogId) => {
  if (newDialogId) {
    loadMessages(newDialogId);
    const clientDialog = dialogs.value.find(d => d.dialogId === newDialogId);
    const companionBotDialogId = clientDialog?.meta?.companionBotDialogId?.value || 
                                 clientDialog?.meta?.companionBotDialogId;
    
    if (companionBotDialogId) {
      loadCompanionMessages(companionBotDialogId);
    } else {
      companionDialogId.value = null;
      companionMessages.value = [];
    }
  }
});

const handleSelectDialog = (dialogId) => {
  selectDialog(dialogId);
};

const handleSendMessage = async (content) => {
  await sendMessage(content);
  // Перезагружаем сообщения бота после отправки, если есть companionDialogId
  if (companionDialogId.value) {
    loadCompanionMessages(companionDialogId.value);
  }
};

const handleUseSuggestion = (suggestionText) => {
  const cleanText = suggestionText.replace(/^💡 Подсказка для ответа клиенту[^:]+:\s*\n\n/, '');
  const finalText = cleanText.replace(/^\*\*Подсказка для менеджера:\*\*\s*\n\n?/, '').trim();
  nextTick(() => {
    if (clientChatRef.value?.setInputTextAndFocus) {
      clientChatRef.value.setInputTextAndFocus(finalText);
    }
  });
};

const handleCompanionMessageSent = () => {
  if (companionDialogId.value) {
    reloadMessages(companionDialogId.value);
  }
};
</script>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 1rem 2rem;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.header h1 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.column {
  flex: 1;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 0.875rem;
}

.column h2 {
  font-size: 1rem;
  margin: 0;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: #fff;
}

.column.dialog-list {
  flex: 0 0 250px;
  min-width: 250px;
  max-width: 250px;
}

.column:last-child {
  border-right: none;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}
</style>
