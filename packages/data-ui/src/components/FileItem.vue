<template>
  <div class="file-item" :class="`status-${file.status}`">
    <div class="file-info">
      <div class="file-name">{{ file.originalName }}</div>
      <div class="file-meta">
        <span class="file-size">{{ formatSize(file.size) }}</span>
        <span class="file-status" :class="`status-${file.status}`">
          {{ getStatusText(file.status) }}
        </span>
        <span v-if="file.fileId" class="file-id">
          ID: {{ file.fileId.substring(0, 20) }}...
        </span>
      </div>
    </div>
    <div class="file-actions">
      <button
        v-if="file.status === 'pending' || file.status === 'error'"
        @click="handleUploadToGigaChat"
        :disabled="uploading"
        class="btn btn-primary"
      >
        {{ uploading ? 'Загрузка...' : 'Загрузить в GigaChat' }}
      </button>
      <button
        v-if="file.status === 'uploaded'"
        @click="handleDeleteFromGigaChat"
        :disabled="deleting"
        class="btn btn-danger"
      >
        {{ deleting ? 'Удаление...' : 'Удалить из GigaChat' }}
      </button>
      <button
        @click="handleDeleteFile"
        :disabled="deleting"
        class="btn btn-secondary"
      >
        Удалить из БД
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  file: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['upload-to-gigachat', 'delete-from-gigachat', 'delete-file']);

const uploading = ref(false);
const deleting = ref(false);

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const getStatusText = (status) => {
  const statusMap = {
    pending: 'Ожидает загрузки',
    uploading: 'Загрузка...',
    uploaded: 'Загружено в AI облако',
    error: 'Не загружено в AI облако'
  };
  return statusMap[status] || status;
};

const handleUploadToGigaChat = async () => {
  uploading.value = true;
  try {
    await emit('upload-to-gigachat', props.file._id);
  } finally {
    uploading.value = false;
  }
};

const handleDeleteFromGigaChat = async () => {
  deleting.value = true;
  try {
    await emit('delete-from-gigachat', props.file._id);
  } finally {
    deleting.value = false;
  }
};

const handleDeleteFile = async () => {
  if (confirm('Вы уверены, что хотите удалить этот файл?')) {
    deleting.value = true;
    try {
      await emit('delete-file', props.file._id);
    } finally {
      deleting.value = false;
    }
  }
};
</script>

<style scoped>
.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  background: #fff;
}

.file-item.status-uploaded {
  border-color: #4caf50;
}

.file-item.status-error {
  border-color: #f44336;
}

.file-item.status-uploading {
  border-color: #ff9800;
}

.file-info {
  flex: 1;
}

.file-name {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.file-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #666;
}

.file-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.file-status.status-pending {
  background: #e0e0e0;
}

.file-status.status-uploading {
  background: #fff3cd;
  color: #856404;
}

.file-status.status-uploaded {
  background: #d4edda;
  color: #155724;
}

.file-status.status-error {
  background: #f8d7da;
  color: #721c24;
}

.file-id {
  font-family: monospace;
  font-size: 0.75rem;
}

.file-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

.btn-secondary {
  background: #757575;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #616161;
}
</style>
