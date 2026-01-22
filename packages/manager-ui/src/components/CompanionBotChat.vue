<template>
  <div class="companion-bot-chat">
    <div class="chat-header">
      <h3>Бот-компаньон</h3>
      <span v-if="companionDialogId" class="dialog-id">{{ companionDialogId }}</span>
    </div>
    <div class="chat-messages">
      <div 
        v-for="message in messages" 
        :key="message.messageId || message._id"
        class="message suggestion"
      >
        <div class="message-content">{{ message.content }}</div>
        <div class="message-time">{{ formatTime(message.createdAt) }}</div>
        <button 
          class="use-button"
          @click="handleUseSuggestion(message.content)"
        >
          Использовать
        </button>
      </div>
      <div v-if="messages.length === 0" class="empty">
        Подсказки от бота-компаньона появятся здесь
      </div>
    </div>
    <div class="chat-input">
      <input 
        v-model="inputText" 
        @keyup.enter="handleSend"
        placeholder="Введите сообщение..."
        type="text"
      />
      <button @click="handleSend">Отправить</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { sendMessage as sendMessageAPI } from '../api/companionBot.js';

const props = defineProps({
  clientDialogId: {
    type: String,
    default: null
  },
  messages: {
    type: Array,
    default: () => []
  },
  companionDialogId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['use-suggestion', 'message-sent']);

const inputText = ref('');

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const handleUseSuggestion = (suggestionText) => {
  // Убираем префикс "💡 Подсказка для ответа клиенту..."
  const cleanText = suggestionText.replace(/^💡 Подсказка для ответа клиенту[^:]+:\s*\n\n/, '');
  emit('use-suggestion', cleanText);
};

const handleSend = async () => {
  if (!inputText.value.trim() || !props.companionDialogId) return;
  
  try {
    const response = await sendMessageAPI(props.companionDialogId, inputText.value);
    if (response.success) {
      inputText.value = '';
      emit('message-sent');
    }
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
  }
};
</script>

<style scoped>
.companion-bot-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.chat-header h3 {
  margin: 0;
  font-size: 1.125rem;
  flex: 1;
}

.dialog-id {
  font-size: 0.875rem;
  color: #666;
  font-weight: normal;
  font-family: monospace;
  background: #f5f5f5;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #fafafa;
  min-height: 0; /* Важно для flex */
}

.message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #fff;
  border-radius: 8px;
  border-left: 3px solid #4caf50;
}

.message.suggestion {
  background: #f1f8e9;
}

.message-content {
  margin-bottom: 0.5rem;
}

.message-time {
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 0.5rem;
}

.use-button {
  padding: 0.25rem 0.75rem;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.use-button:hover {
  background: #388e3c;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: #999;
}

.chat-input {
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
  background: #fff;
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  min-height: 60px;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.chat-input input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 1rem;
  min-height: 40px;
  box-sizing: border-box;
}

.chat-input button {
  padding: 0.5rem 1rem;
  background: #2196f3;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.chat-input button:hover {
  background: #1976d2;
}
</style>
