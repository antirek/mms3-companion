<template>
  <div class="dialog-list">
    <div 
      v-for="dialog in dialogs" 
      :key="dialog.dialogId"
      :class="['dialog-item', { active: dialog.dialogId === activeDialogId }]"
      @click="$emit('select-dialog', dialog.dialogId)"
    >
      <div class="dialog-name">{{ getDialogName(dialog) }}</div>
      <div class="dialog-preview" v-if="dialog.lastMessage">
        {{ dialog.lastMessage.content?.substring(0, 50) }}
      </div>
    </div>
    <div v-if="dialogs.length === 0" class="empty">
      Нет диалогов с клиентами
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  dialogs: {
    type: Array,
    default: () => []
  },
  activeDialogId: {
    type: String,
    default: null
  }
});

const getDialogName = (dialog) => {
  // Получаем имя клиента из участников диалога
  // Пока используем имя диалога или ID
  return dialog.name || dialog.dialogId;
};
</script>

<style scoped>
.dialog-list {
  overflow-y: auto;
  flex: 1;
}

.dialog-item {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  cursor: pointer;
  transition: background 0.2s;
}

.dialog-item:hover {
  background: #f5f5f5;
}

.dialog-item.active {
  background: #e3f2fd;
}

.dialog-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.dialog-preview {
  font-size: 0.75rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: #999;
}
</style>
