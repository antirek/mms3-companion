import express from 'express';
import { getDialogMessages, sendMessage } from '../controllers/messagesController.js';

const router = express.Router();

// GET /api/messages/:dialogId - получение сообщений диалога
router.get('/:dialogId', getDialogMessages);

// POST /api/messages/:dialogId - отправка сообщения
router.post('/:dialogId', sendMessage);

export default router;
