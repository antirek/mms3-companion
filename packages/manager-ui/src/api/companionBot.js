import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export async function getCompanionDialog(clientDialogId) {
  try {
    const response = await api.get(`/companion-bot/dialog/${clientDialogId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching companion bot dialog for client dialog ${clientDialogId}:`, error);
    return { success: false, error: error.message };
  }
}

export async function getCompanionMessages(clientDialogId) {
  try {
    const response = await api.get(`/companion-bot/messages/${clientDialogId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching companion bot messages for client dialog ${clientDialogId}:`, error);
    return { success: false, error: error.message };
  }
}

export async function sendMessage(companionDialogId, content) {
  try {
    const response = await api.post(`/companion-bot/messages/${companionDialogId}`, {
      content
    });
    return response.data;
  } catch (error) {
    console.error(`Error sending message to companion bot dialog ${companionDialogId}:`, error);
    return { success: false, error: error.message };
  }
}
