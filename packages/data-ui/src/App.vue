<template>
  <div class="app">
    <header>
      <h1>Управление файлами для GigaChat</h1>
    </header>
    <main>
      <FileUpload :on-upload="handleUpload" />
      <FileList
        :files="files"
        :loading="loading"
        :error="error"
        @upload-to-gigachat="handleUploadToGigaChat"
        @delete-from-gigachat="handleDeleteFromGigaChat"
        @delete-file="handleDeleteFile"
      />
    </main>
  </div>
</template>

<script setup>
import { useFiles } from './composables/useFiles.js';
import FileUpload from './components/FileUpload.vue';
import FileList from './components/FileList.vue';

const {
  files,
  loading,
  error,
  uploadFile,
  uploadToGigaChat,
  deleteFile,
  deleteFromGigaChat
} = useFiles();

const handleUpload = async (file) => {
  await uploadFile(file);
};

const handleUploadToGigaChat = async (fileId) => {
  await uploadToGigaChat(fileId);
};

const handleDeleteFromGigaChat = async (fileId) => {
  await deleteFromGigaChat(fileId);
};

const handleDeleteFile = async (fileId) => {
  await deleteFile(fileId);
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  margin-bottom: 2rem;
}

header h1 {
  color: #333;
}

main {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
</style>
