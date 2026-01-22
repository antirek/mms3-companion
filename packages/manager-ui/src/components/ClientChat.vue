<template>
  <div class="client-chat">
    <div class="chat-header">
      <h3>{{ getClientName() }}</h3>
      <span v-if="clientUserId" class="client-user-id">{{ clientUserId }}</span>
    </div>
    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="message in messages" 
        :key="message.messageId || message._id"
        :class="['message', { 'own-message': isOwnMessage(message) }]"
      >
        <div class="message-content">{{ message.content }}</div>
        <div class="message-meta">
          <span class="message-sender">{{ message.senderId || 'Unknown' }}</span>
          <span class="message-time">{{ formatTime(message.createdAt) }}</span>
        </div>
      </div>
    </div>
    <div class="chat-input" ref="chatInputRef">
      <input 
        ref="messageInput"
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
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { getDialogMembers } from '../api/manager.js';

const props = defineProps({
  dialog: {
    type: Object,
    required: true
  },
  messages: {
    type: Array,
    default: () => []
  },
  managerUserId: {
    type: String,
    default: 'carl'
  }
});

const emit = defineEmits(['send-message']);

const inputText = ref('');
const chatInputRef = ref(null);
const messagesContainer = ref(null);
const messageInput = ref(null);
const dialogMembers = ref([]);

// Получаем userId контакта (не менеджера)
const clientUserId = computed(() => {
  if (!dialogMembers.value || dialogMembers.value.length === 0) {
    return null;
  }
  
  // Находим участника, который не является менеджером
  const client = dialogMembers.value.find(member => 
    member.userId !== props.managerUserId && member.type !== 'bot'
  );
  
  return client ? client.userId : null;
});

const getClientName = () => {
  return props.dialog.name || 'Клиент';
};

// Загружаем участников диалога
const loadDialogMembers = async () => {
  try {
    const response = await getDialogMembers(props.dialog.dialogId);
    if (response.success) {
      dialogMembers.value = response.data || [];
    }
  } catch (error) {
    console.error('Ошибка при загрузке участников диалога:', error);
  }
};

const isOwnMessage = (message) => {
  // Проверяем, является ли сообщение от менеджера
  return message.senderId === props.managerUserId;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '—';
  
  // Обрабатываем разные форматы timestamp
  let date;
  if (typeof timestamp === 'number') {
    // Если это число в миллисекундах или микросекундах
    date = timestamp > 1000000000000 
      ? new Date(timestamp) 
      : new Date(timestamp * 1000); // Если секунды, умножаем на 1000
  } else if (typeof timestamp === 'string') {
    // Пытаемся распарсить строку как число
    const numTimestamp = parseFloat(timestamp);
    if (!isNaN(numTimestamp)) {
      date = numTimestamp > 1000000000000 
        ? new Date(numTimestamp) 
        : new Date(numTimestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
  } else {
    return '—';
  }
  
  if (isNaN(date.getTime())) {
    return '—';
  }
  
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const handleSend = () => {
  if (inputText.value.trim()) {
    emit('send-message', inputText.value);
    inputText.value = '';
  }
};

// Метод для установки текста и фокуса (вызывается из родительского компонента)
const setInputTextAndFocus = (text) => {
  inputText.value = text;
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.focus();
      // Устанавливаем курсор в конец текста
      messageInput.value.setSelectionRange(text.length, text.length);
    }
  });
};

// Экспортируем метод для использования из родительского компонента
defineExpose({
  setInputTextAndFocus
});

// Функция для прокрутки вниз
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

// Прокручиваем вниз при изменении сообщений
watch(() => props.messages, () => {
  scrollToBottom();
}, { deep: true });

// Прокручиваем к полю ввода при монтировании и загружаем участников
onMounted(() => {
  loadDialogMembers();
  scrollToBottom();
});
</script>

<style scoped>
.client-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; /* Важно для flex */
  position: relative;
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
  font-size: 1rem;
  flex: 1;
}

.client-user-id {
  font-size: 0.75rem;
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
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.message {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  max-width: 70%;
  word-wrap: break-word;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Сообщения от контакта - слева */
.message {
  align-self: flex-start;
  background: #fff;
  border-bottom-left-radius: 4px;
}

/* Сообщения от менеджера - справа */
.message.own-message {
  align-self: flex-end;
  background: #2196f3;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-content {
  line-height: 1.4;
  word-break: break-word;
  font-size: 0.875rem;
}

.message.own-message .message-content {
  color: #fff;
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.375rem;
  font-size: 0.75rem;
  opacity: 0.85;
  min-height: 1.2rem;
}

.message-sender {
  font-family: monospace;
  font-weight: 500;
  font-size: 0.75rem;
  color: inherit;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.85;
  color: inherit;
  white-space: nowrap;
}

.message.own-message .message-meta {
  color: rgba(255, 255, 255, 0.8);
}

.message.own-message .message-sender,
.message.own-message .message-time {
  color: rgba(255, 255, 255, 0.8);
}

.chat-input {
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
  background: #fff;
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0; /* Не сжимается */
  min-height: 60px; /* Минимальная высота */
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.chat-input input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 0.875rem;
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
  font-size: 0.875rem;
}

.chat-input button:hover {
  background: #1976d2;
}
</style>
