<template>
  <div class="file-list">
    <h3>Список файлов</h3>
    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="files.length === 0" class="empty">Нет загруженных файлов</div>
    <div v-else>
      <FileItem
        v-for="file in files"
        :key="file._id"
        :file="file"
        @upload-to-gigachat="handleUploadToGigaChat"
        @delete-from-gigachat="handleDeleteFromGigaChat"
        @delete-file="handleDeleteFile"
      />
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import FileItem from './FileItem.vue';

const props = defineProps({
  files: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['upload-to-gigachat', 'delete-from-gigachat', 'delete-file']);

const handleUploadToGigaChat = async (fileId) => {
  emit('upload-to-gigachat', fileId);
};

const handleDeleteFromGigaChat = async (fileId) => {
  emit('delete-from-gigachat', fileId);
};

const handleDeleteFile = async (fileId) => {
  emit('delete-file', fileId);
};
</script>

<style scoped>
.file-list {
  padding: 1.5rem;
}

.file-list h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.loading,
.error,
.empty {
  padding: 1rem;
  text-align: center;
  color: #666;
}

.error {
  color: #f44336;
}
</style>
