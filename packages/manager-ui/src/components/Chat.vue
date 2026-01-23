<template>
  <div class="chat">
    <div class="chat-header">
      <h3>{{ headerTitle }}</h3>
      <span v-if="headerSubtitle" class="header-subtitle">{{ headerSubtitle }}</span>
    </div>
    <div class="chat-messages" ref="messagesContainer">
      <template v-for="(message, index) in messages" :key="`msg-${message.messageId || message._id || index}`">
        <!-- Разделитель перед сообщением клиента (только для бота) -->
        <div 
          v-if="isBotMode && isClientMessage(message) && shouldShowDivider(messages, index)"
          class="message-divider"
        >
          <span class="divider-text">Сообщение от клиента</span>
        </div>
        
        <!-- Сообщение клиента (только для бота) -->
        <div 
          v-if="isBotMode && isClientMessage(message)"
          class="message client-message"
        >
          <div class="message-content" v-html="formatClientMessage(message.content)"></div>
          <div class="message-time">{{ formatTime(message.createdAt) }}</div>
        </div>
        
        <!-- Разделитель перед подсказкой бота -->
        <div 
          v-if="isBotMode && isBotMessage(message) && isSuggestion(message) && shouldShowDivider(messages, index)"
          class="message-divider"
        >
          <span class="divider-text">Подсказка от бота</span>
        </div>
        
        <!-- Обычное сообщение -->
        <div 
          v-if="!isBotMode || !isClientMessage(message)"
          :class="['message', getMessageClass(message)]"
        >
          <!-- Подсказка с рекомендацией (только для бота) -->
          <div v-if="isBotMode && isBotMessage(message) && isSuggestion(message) && parseSuggestion(message.content)" class="suggestion-content">
            <!-- Секция 1: Сообщение клиента -->
            <div v-if="parseSuggestion(message.content).clientMessage" class="client-message-section">
              <div class="section-title">📩 Сообщение от клиента:</div>
              <div class="client-message-text">{{ parseSuggestion(message.content).clientMessage }}</div>
            </div>
            
            <!-- Секция 2: Рекомендация -->
            <div class="recommendation-section">
              <div class="section-title">💡 Рекомендация:</div>
              <div class="recommendation-text">
                {{ parseSuggestion(message.content).recommendation || 'нет рекомендации' }}
              </div>
            </div>
            
            <!-- Секция 3: Примеры ответов -->
            <div class="examples-section">
              <div class="section-title">📝 Примеры ответов:</div>
              <div v-if="parseSuggestion(message.content).examples && parseSuggestion(message.content).examples.length > 0">
                <div 
                  v-for="(example, idx) in parseSuggestion(message.content).examples" 
                  :key="idx"
                  class="example-item"
                >
                  <div class="example-number">{{ idx + 1 }}.</div>
                  <div class="example-text">{{ example }}</div>
                  <button 
                    class="copy-button"
                    @click="handleCopyExample(example)"
                    :title="'Скопировать пример ' + (idx + 1)"
                  >
                    📋 Копировать
                  </button>
                </div>
              </div>
              <div v-else class="no-examples">
                нет примеров
              </div>
            </div>
          </div>
          <!-- Обычное сообщение -->
          <div v-else class="message-content">{{ message.content }}</div>
          <div class="message-meta">
            <span class="message-sender">{{ message.senderId || 'Unknown' }}</span>
            <span class="message-time">{{ formatTime(message.createdAt) }}</span>
          </div>
        </div>
      </template>
      <div v-if="messages.length === 0" class="empty">
        {{ emptyMessage }}
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
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { sendMessage as sendMessageAPI } from '../api/manager.js';

const props = defineProps({
  // Режим: 'client' или 'bot'
  mode: {
    type: String,
    default: 'client',
    validator: (value) => ['client', 'bot'].includes(value)
  },
  // Диалог (для режима client)
  dialog: {
    type: Object,
    default: null
  },
  // Сообщения
  messages: {
    type: Array,
    default: () => []
  },
  // ID диалога для отправки сообщений
  dialogId: {
    type: String,
    required: true
  },
  // ID менеджера
  managerUserId: {
    type: String,
    default: 'carl'
  }
});

const emit = defineEmits(['use-suggestion']);

const inputText = ref('');
const chatInputRef = ref(null);
const messagesContainer = ref(null);
const messageInput = ref(null);

const isBotMode = computed(() => props.mode === 'bot');

const headerTitle = computed(() => {
  if (isBotMode.value) {
    return 'Бот-компаньон';
  }
  // Для режима client получаем имя из dialog
  const members = props.dialog?.members || [];
  const client = members.find(member => 
    member.userId !== props.managerUserId && member.type !== 'bot'
  );
  return client?.name || props.dialog?.name || 'Клиент';
});

const headerSubtitle = computed(() => {
  if (isBotMode.value) {
    return props.companionDialogId;
  }
  const members = props.dialog?.members || [];
  const client = members.find(member => 
    member.userId !== props.managerUserId && member.type !== 'bot'
  );
  return client?.userId || null;
});

const emptyMessage = computed(() => {
  return isBotMode.value 
    ? 'Подсказки от бота-компаньона появятся здесь'
    : 'Нет сообщений';
});

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  let date;
  if (typeof timestamp === 'number') {
    date = timestamp > 1000000000000 
      ? new Date(timestamp) 
      : new Date(timestamp * 1000);
  } else if (typeof timestamp === 'string') {
    const numTimestamp = parseFloat(timestamp);
    if (!isNaN(numTimestamp)) {
      date = numTimestamp > 1000000000000 
        ? new Date(numTimestamp) 
        : new Date(numTimestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
  } else {
    return '';
  }
  
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const isOwnMessage = (message) => {
  return message.senderId === props.managerUserId;
};

const isBotMessage = (message) => {
  return message.senderId !== props.managerUserId;
};

const isClientMessage = (message) => {
  return message.meta?.isClientMessage?.value === true || 
         message.meta?.isClientMessage === true;
};

const isSuggestion = (message) => {
  return message.meta?.class?.value === 'suggestion' ||
         message.meta?.class === 'suggestion' ||
         message.meta?.isSuggestion?.value === true || 
         message.meta?.isSuggestion === true ||
         (message.content && (
           message.content.startsWith('📩 Сообщение от клиента') ||
           message.content.startsWith('💡 Подсказка для ответа клиенту')
         ));
};

const getMessageClass = (message) => {
  if (isBotMode.value) {
    return isBotMessage(message) ? 'bot-message' : 'manager-message';
  }
  return isOwnMessage(message) ? 'own-message' : '';
};

const formatClientMessage = (content) => {
  if (content && content.includes('📩 Сообщение от клиента')) {
    const match = content.match(/📩 Сообщение от клиента[^:]+:\s*\n\n(.*)/s);
    if (match && match[1]) {
      return match[1].trim().replace(/\n/g, '<br>');
    }
    const match2 = content.match(/📩 Сообщение от клиента[^:]+:\s*\n(.*)/s);
    if (match2 && match2[1]) {
      return match2[1].trim().replace(/\n/g, '<br>');
    }
  }
  return (content || '').replace(/\n/g, '<br>');
};

const shouldShowDivider = (messages, index) => {
  if (index === 0) return false;
  
  const current = messages[index];
  const previous = messages[index - 1];
  
  const currentIsClient = isClientMessage(current);
  const currentIsSuggestion = isSuggestion(current) && isBotMessage(current);
  const previousIsClient = isClientMessage(previous);
  const previousIsSuggestion = isSuggestion(previous) && isBotMessage(previous);
  
  if (currentIsClient && !previousIsClient) return true;
  if (currentIsSuggestion && !previousIsSuggestion) return true;
  
  return false;
};

const parseSuggestion = (content) => {
  if (!content) return null;
  
  const clientMessageMatch = content.match(/📩 Сообщение от клиента[^:]+:\s*\n(.*?)(?=\n\n💡|$)/s);
  const clientMessage = clientMessageMatch ? clientMessageMatch[1].trim() : null;
  
  const recommendationMatch = content.match(/💡 Рекомендация:\s*\n(.*?)(?=\n\n📝|$)/s);
  const recommendation = recommendationMatch ? recommendationMatch[1].trim() : null;
  
  const examplesMatch = content.match(/📝 Примеры ответов:\s*\n(.*?)$/s);
  let examples = [];
  
  if (examplesMatch) {
    const examplesText = examplesMatch[1];
    const examplePattern = /^\d+\.\s*(.+?)(?=\n\d+\.|$)/gms;
    let match;
    while ((match = examplePattern.exec(examplesText)) !== null) {
      const exampleText = match[1].trim();
      if (exampleText && exampleText !== 'Примеры не найдены') {
        examples.push(exampleText);
      }
    }
    
    if (examples.length === 0) {
      const lines = examplesText.split('\n').filter(line => line.trim());
      examples = lines
        .filter(line => /^\d+\./.test(line.trim()) && !line.includes('Примеры не найдены'))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0);
    }
  }
  
  if (!clientMessage && !recommendation && examples.length === 0) {
    return null;
  }
  
  return {
    clientMessage: clientMessage || null,
    recommendation: recommendation || '',
    examples: examples
  };
};

const handleCopyExample = (exampleText) => {
  emit('use-suggestion', exampleText);
};

const handleSend = async () => {
  if (!inputText.value.trim() || !props.dialogId) {
    return;
  }
  
  try {
    const response = await sendMessageAPI(props.dialogId, inputText.value);
    if (response.success) {
      inputText.value = '';
      scrollToBottom();
      // WebSocket автоматически обновит сообщения
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

// Метод для установки текста и фокуса (для режима client)
const setInputTextAndFocus = (text) => {
  inputText.value = text;
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.focus();
      messageInput.value.setSelectionRange(text.length, text.length);
    }
  });
};

defineExpose({
  setInputTextAndFocus
});

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

watch(() => props.messages, () => {
  scrollToBottom();
}, { deep: true, immediate: false });

onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
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

.header-subtitle {
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
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.message-divider {
  display: flex;
  align-items: center;
  margin: 0.75rem 0;
  position: relative;
}

.message-divider::before,
.message-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e0e0e0;
}

.divider-text {
  padding: 0 0.75rem;
  font-size: 0.75rem;
  color: #999;
  background: #fafafa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

/* Режим client */
.message {
  align-self: flex-start;
  background: #fff;
  border-bottom-left-radius: 4px;
}

.message.own-message {
  align-self: flex-end;
  background: #2196f3;
  color: #fff;
  border-bottom-right-radius: 4px;
}

/* Режим bot */
.message.manager-message {
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
  align-self: flex-end;
  margin-left: auto;
  max-width: 80%;
}

.message.client-message {
  background: #fff3e0;
  border-left: 3px solid #ff9800;
  align-self: flex-start;
  max-width: 85%;
  margin-bottom: 0.5rem;
}

.message.bot-message {
  background: #f1f8e9;
  border-left: 3px solid #4caf50;
  align-self: flex-start;
  max-width: 90%;
}

.message-content {
  line-height: 1.4;
  word-break: break-word;
  font-size: 0.875rem;
  margin-bottom: 0.375rem;
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

.suggestion-content {
  width: 100%;
}

.client-message-section {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed #e0e0e0;
}

.client-message-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: #666;
  padding: 0.5rem;
  background: #fff3e0;
  border-radius: 4px;
  border-left: 3px solid #ff9800;
  font-style: italic;
}

.recommendation-section {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed #e0e0e0;
}

.section-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #4caf50;
  margin-bottom: 0.5rem;
}

.recommendation-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: #333;
  padding: 0.5rem;
  background: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #4caf50;
}

.examples-section {
  margin-top: 0.75rem;
}

.example-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.example-item:hover {
  border-color: #4caf50;
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.1);
}

.example-number {
  font-weight: 600;
  color: #4caf50;
  font-size: 0.875rem;
  min-width: 1.5rem;
}

.example-text {
  flex: 1;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #333;
  word-wrap: break-word;
}

.copy-button {
  padding: 0.375rem 0.75rem;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  white-space: nowrap;
  transition: background 0.2s;
  flex-shrink: 0;
}

.copy-button:hover {
  background: #388e3c;
}

.no-examples {
  font-style: italic;
  color: #999;
  padding: 0.5rem;
  text-align: center;
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
