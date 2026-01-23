import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export async function getManagerDialogs() {
  const response = await api.get('/dialogs');
  return response.data;
}

export async function getDialogMessages(dialogId) {
  const response = await api.get(`/messages/${dialogId}`);
  return response.data;
}

export async function sendMessage(dialogId, content) {
  const response = await api.post(`/messages/${dialogId}`, { content });
  return response.data;
}
