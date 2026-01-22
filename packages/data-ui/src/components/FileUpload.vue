<template>
  <div class="file-upload">
    <h3>Загрузить новый файл</h3>
    <form @submit.prevent="handleSubmit">
      <div class="upload-area">
        <input
          type="file"
          ref="fileInput"
          @change="handleFileSelect"
          accept=".txt"
          :disabled="uploading"
        />
        <div v-if="selectedFile" class="selected-file">
          Выбран: {{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})
        </div>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <button type="submit" :disabled="!selectedFile || uploading" class="btn btn-primary">
        {{ uploading ? 'Загрузка...' : 'Загрузить' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  onUpload: {
    type: Function,
    required: true
  }
});

const fileInput = ref(null);
const selectedFile = ref(null);
const uploading = ref(false);
const error = ref(null);

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) {
    selectedFile.value = null;
    return;
  }

  // Валидация
  if (!file.name.endsWith('.txt')) {
    error.value = 'Разрешены только файлы .txt';
    selectedFile.value = null;
    fileInput.value.value = '';
    return;
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    error.value = 'Размер файла не должен превышать 5MB';
    selectedFile.value = null;
    fileInput.value.value = '';
    return;
  }

  error.value = null;
  selectedFile.value = file;
};

const handleSubmit = async () => {
  if (!selectedFile.value) return;

  uploading.value = true;
  error.value = null;

  try {
    await props.onUpload(selectedFile.value);
    // Сброс формы
    selectedFile.value = null;
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  } catch (err) {
    error.value = err.message || 'Ошибка при загрузке файла';
  } finally {
    uploading.value = false;
  }
};
</script>

<style scoped>
.file-upload {
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 2rem;
  background: #f9f9f9;
}

.file-upload h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.upload-area {
  margin-bottom: 1rem;
}

.selected-file {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #e3f2fd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.error {
  color: #f44336;
  margin-bottom: 1rem;
  font-size: 0.875rem;
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
</style>
