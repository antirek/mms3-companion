/**
 * Контроллер для работы с сообщениями
 */
export async function getDialogMessages(req, res) {
  try {
    const { chat3Client } = req.app.locals;
    const { dialogId } = req.params;
    const { limit = 50 } = req.query;

    // Используем метод getDialogMessages из chat3-client
    // GET /api/dialogs/:dialogId/messages
    const params = {
      limit: parseInt(limit),
      sort: JSON.stringify({ createdAt: 1 }) // По возрастанию (старые первыми)
    };

    const messages = await chat3Client.getDialogMessages(dialogId, params);
    const messagesData = messages?.data || messages || [];

    res.json({
      success: true,
      data: Array.isArray(messagesData) ? messagesData : []
    });
  } catch (error) {
    console.error('Ошибка при получении сообщений:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}

export async function sendMessage(req, res) {
  try {
    const { chat3Client, managerUserId, broadcast } = req.app.locals;
    const { dialogId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Содержимое сообщения обязательно'
      });
    }

    // Отправляем сообщение от имени менеджера
    const message = await chat3Client.createMessage(dialogId, {
      senderId: managerUserId,
      type: 'internal.text',
      content: content
    });

    const messageData = message?.data || message;

    // Отправляем обновление через WebSocket
    broadcast({
      type: 'message.created',
      dialogId: dialogId,
      message: messageData
    });

    res.json({
      success: true,
      data: messageData
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}
