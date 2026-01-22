import express from 'express';
import { getCompanionDialog, getCompanionMessages, sendCompanionMessage } from '../controllers/companionBotController.js';

const router = express.Router();

// GET /api/companion-bot/dialog/:clientDialogId - получение диалога с ботом для клиента
router.get('/dialog/:clientDialogId', getCompanionDialog);

// GET /api/companion-bot/messages/:clientDialogId - получение подсказок от бота
router.get('/messages/:clientDialogId', getCompanionMessages);

// POST /api/companion-bot/messages/:companionDialogId - отправка сообщения в диалог с ботом
router.post('/messages/:companionDialogId', sendCompanionMessage);

export default router;
