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
          :client-dialog-id="activeDialogId"
          :messages="companionMessages"
          :companion-dialog-id="companionBotDialog?.dialogId || companionDialogId"
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
      companionBotDialogId: companionBotDialog.value?.dialogId,
      messageId: message.messageId,
      senderId: message.senderId
    });
    
    // Проверяем, является ли это сообщением в диалоге с ботом-компаньоном
    const companionBotDialogId = companionBotDialog.value?.dialogId || companionDialogId.value;
    const isCompanionBotMessage = dialogId === companionBotDialogId;
    
    // Если это сообщение в активном диалоге с клиентом, добавляем его в список
    if (dialogId === activeDialogId.value && !isCompanionBotMessage) {
      // Проверяем, нет ли уже такого сообщения (избегаем дубликатов)
      const exists = clientMessages.value.some(m => 
        (m.messageId || m._id) === (message.messageId || message._id)
      );
      
      if (!exists) {
        console.log('Добавляем сообщение клиента в список:', message.messageId);
        clientMessages.value.push(message);
        // Перезагружаем подсказки от бота
        loadCompanionMessages(dialogId);
      } else {
        console.log('Сообщение клиента уже существует в списке');
      }
    } 
    // Если это сообщение в диалоге с ботом-компаньоном для активного клиента
    else if (isCompanionBotMessage && activeDialogId.value) {
      // Проверяем, нет ли уже такого сообщения (избегаем дубликатов)
      const exists = companionMessages.value.some(m => 
        (m.messageId || m._id) === (message.messageId || message._id)
      );
      
      if (!exists) {
        console.log('Добавляем сообщение бота в список:', message.messageId);
        companionMessages.value.push(message);
      } else {
        console.log('Сообщение бота уже существует в списке');
      }
    } else {
      console.log('Сообщение не в активном диалоге, обновляем список диалогов');
      // Если сообщение не в активном диалоге, но это сообщение в диалоге с ботом,
      // перезагружаем сообщения бота для активного диалога
      if (activeDialogId.value) {
        loadCompanionMessages(activeDialogId.value);
      }
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
  // Убираем префикс "💡 Подсказка для ответа клиенту..." если есть
  const cleanText = suggestionText.replace(/^💡 Подсказка для ответа клиенту[^:]+:\s*\n\n/, '');
  
  // Убираем также "**Подсказка для менеджера:**" если есть
  const finalText = cleanText.replace(/^\*\*Подсказка для менеджера:\*\*\s*\n\n?/, '').trim();
  
  // Устанавливаем текст в поле ввода и переключаем фокус
  nextTick(() => {
    if (clientChatRef.value && clientChatRef.value.setInputTextAndFocus) {
      clientChatRef.value.setInputTextAndFocus(finalText);
    }
  });
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
