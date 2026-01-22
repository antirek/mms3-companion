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
          :client-dialog-id="activeDialogId"
          :messages="companionMessages"
          :companion-dialog-id="companionBotDialog?.dialogId || companionDialogId"
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
import { ref, onMounted, watch } from 'vue';
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

const {
  companionMessages,
  companionDialogId,
  companionBotDialog,
  loadCompanionMessages,
  loadCompanionBotDialog,
  reloadMessages
} = useCompanionBot();

// Обработчик сообщений через WebSocket
const handleWebSocketMessage = (data) => {
  console.log('Обработка WebSocket сообщения:', data);
  
  if (data.type === 'message.created' && data.message) {
    const message = data.message;
    const dialogId = data.dialogId;
    
    console.log('Получено новое сообщение:', {
      dialogId,
      activeDialogId: activeDialogId.value,
      messageId: message.messageId,
      senderId: message.senderId
    });
    
    // Если это сообщение в активном диалоге, добавляем его в список
    if (dialogId === activeDialogId.value) {
      // Проверяем, нет ли уже такого сообщения (избегаем дубликатов)
      const exists = clientMessages.value.some(m => 
        (m.messageId || m._id) === (message.messageId || message._id)
      );
      
      if (!exists) {
        console.log('Добавляем сообщение в список:', message.messageId);
        clientMessages.value.push(message);
        // Перезагружаем подсказки от бота
        loadCompanionMessages(dialogId);
      } else {
        console.log('Сообщение уже существует в списке');
      }
    } else {
      console.log('Сообщение не в активном диалоге, обновляем список диалогов');
    }
    
    // Обновляем список диалогов для обновления последнего сообщения
    loadDialogs();
  }
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
    // Загружаем сообщения клиента
    loadMessages(newDialogId);
    // Загружаем диалог с ботом (получаем dialogId)
    loadCompanionBotDialog(newDialogId);
    // Загружаем сообщения бота-компаньона
    loadCompanionMessages(newDialogId);
  }
});

const handleSelectDialog = (dialogId) => {
  selectDialog(dialogId);
};

const handleSendMessage = async (content) => {
  await sendMessage(content);
  // Перезагружаем сообщения после отправки
  if (activeDialogId.value) {
    loadCompanionMessages(activeDialogId.value);
  }
};

const handleUseSuggestion = (suggestionText) => {
  // Передаем подсказку в ClientChat для использования
  // Это будет реализовано через ref или emit
};

const handleCompanionMessageSent = () => {
  // Перезагружаем сообщения после отправки
  if (activeDialogId.value) {
    reloadMessages(activeDialogId.value);
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
  font-size: 1.5rem;
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
