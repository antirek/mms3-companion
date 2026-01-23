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
          :active-dialog-id="clientDialogId"
          @select-dialog="handleSelectDialog"
        />
      </div>
      <div class="column client-chat">
        <Chat 
          v-if="clientDialogId"
          ref="clientManagerChatRef"
          mode="client"
          :dialog="clientDialog"
          :messages="clientMessages"
          :dialog-id="clientDialogId"
          :manager-user-id="managerUserId"
        />
        <div v-else class="empty-state">
          <p>Выберите диалог для просмотра</p>
        </div>
      </div>
      <div class="column companion-bot-chat">
        <Chat 
          v-if="botDialogId"
          ref="botManagerChatRef"
          mode="bot"
          :messages="botMessages"
          :dialog-id="botDialogId"
          :manager-user-id="managerUserId"
          @use-suggestion="handleUseSuggestion"
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
import Chat from './components/Chat.vue';

const {
  dialogs,
  clientDialogId,
  clientDialog,
  clientMessages,
  loadDialogs,
  selectDialog,
  loadMessages,
  sendMessage
} = useManagerChat();

// ID менеджера (можно вынести в конфигурацию)
const managerUserId = ref('carl');

// Ref для компонентов чатов
const clientManagerChatRef = ref(null);
const botManagerChatRef = ref(null);

const {
  botMessages,
  botDialogId,
  loadBotMessages,
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
  const isClientDialog = dialogId === clientDialogId.value;
  
  // Проверяем botDialogId из мета-тегов диалога клиент-менеджер, если он не установлен
  let currentBotDialogId = botDialogId.value;
  if (!currentBotDialogId && clientDialog.value) {
    currentBotDialogId = clientDialog.value.meta?.companionBotDialogId?.value || 
                         clientDialog.value.meta?.companionBotDialogId;
  }
  const isBotDialog = dialogId === currentBotDialogId;

  if (!isClientDialog && !isBotDialog) {
    loadDialogs();
    return;
  }

  // Обработка сообщения в диалоге клиент-менеджер
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
      if (botDialogId.value) {
        loadBotMessages(botDialogId.value);
      }
    }
  }

  // Обработка сообщения в диалоге бот-менеджер
  if (isBotDialog) {
    // Устанавливаем botDialogId, если он еще не установлен
    if (!botDialogId.value && currentBotDialogId) {
      botDialogId.value = currentBotDialogId;
    }
    
    const existingIndex = botMessages.value.findIndex(m => 
      (m.messageId || m._id || m.id) === messageId
    );
    
    if (isUpdate && existingIndex !== -1) {
      botMessages.value[existingIndex] = message;
      botMessages.value = [...botMessages.value];
    } else if (!isUpdate && existingIndex === -1) {
      const newMessages = [...botMessages.value, message];
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
      botMessages.value = newMessages;
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

// При изменении диалога клиент-менеджер загружаем сообщения
watch(clientDialogId, (newDialogId) => {
  if (newDialogId) {
    loadMessages(newDialogId);
    const dialog = dialogs.value.find(d => d.dialogId === newDialogId);
    const botDialogIdFromMeta = dialog?.meta?.companionBotDialogId?.value || 
                                 dialog?.meta?.companionBotDialogId;
    
    if (botDialogIdFromMeta) {
      loadBotMessages(botDialogIdFromMeta);
    } else {
      botDialogId.value = null;
      botMessages.value = [];
    }
  }
});

const handleSelectDialog = (dialogId) => {
  selectDialog(dialogId);
};

const handleUseSuggestion = (suggestionText) => {
  const cleanText = suggestionText.replace(/^💡 Подсказка для ответа клиенту[^:]+:\s*\n\n/, '');
  const finalText = cleanText.replace(/^\*\*Подсказка для менеджера:\*\*\s*\n\n?/, '').trim();
  nextTick(() => {
    if (clientManagerChatRef.value?.setInputTextAndFocus) {
      clientManagerChatRef.value.setInputTextAndFocus(finalText);
    }
  });
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
