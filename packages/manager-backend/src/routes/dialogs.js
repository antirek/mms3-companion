import express from 'express';
import { getManagerDialogs, getDialog } from '../controllers/dialogsController.js';

const router = express.Router();

// GET /api/dialogs - список диалогов менеджера с клиентами
router.get('/', getManagerDialogs);

// GET /api/dialogs/:dialogId - получение диалога
router.get('/:dialogId', getDialog);

export default router;
