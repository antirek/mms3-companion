/**
 * Контроллер для работы с ботом-компаньоном
 */
export async function getCompanionDialog(req, res) {
  try {
    const { chat3Client } = req.app.locals;
    const { clientDialogId } = req.params;

    // Сначала проверяем мета-тег диалога с контактом на наличие ID диалога бота
    try {
      const clientDialog = await chat3Client.getDialog(clientDialogId);
      const clientDialogData = clientDialog?.data || clientDialog;
      const companionBotDialogId = clientDialogData?.meta?.companionBotDialogId?.value || 
                                    clientDialogData?.meta?.companionBotDialogId;

      if (companionBotDialogId) {
        // Получаем диалог с ботом по ID из мета-тега
        try {
          const companionDialog = await chat3Client.getDialog(companionBotDialogId);
          const companionDialogData = companionDialog?.data || companionDialog;
          
          return res.json({
            success: true,
            data: companionDialogData
          });
        } catch (error) {
          console.warn(`Диалог с ботом ${companionBotDialogId} не найден, ищем по старому способу:`, error.message);
          // Продолжаем поиск по старому способу
        }
      }
    } catch (error) {
      console.warn(`Не удалось получить диалог с контактом ${clientDialogId}, ищем по старому способу:`, error.message);
      // Продолжаем поиск по старому способу
    }

    // Если мета-тега нет, ищем по старому способу (для обратной совместимости)
    const { managerUserId } = req.app.locals;
    const filter = `(meta.clientDialogId,eq,${JSON.stringify(clientDialogId)})&(meta.type,eq,companion_bot)`;
    
    const dialogs = await chat3Client.getUserDialogs(managerUserId, {
      filter: filter,
      limit: 1
    });

    const dialogsData = dialogs?.data || dialogs || [];
    const companionDialog = dialogsData.length > 0 ? dialogsData[0] : null;

    // Если диалог найден, убеждаемся что dialogId присутствует
    if (companionDialog && !companionDialog.dialogId) {
      companionDialog.dialogId = companionDialog._id || companionDialog.id;
    }

    res.json({
      success: true,
      data: companionDialog
    });
  } catch (error) {
    console.error('Ошибка при получении диалога с ботом-компаньоном:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}

export async function getCompanionMessages(req, res) {
  try {
    const { chat3Client } = req.app.locals;
    const { clientDialogId } = req.params;
    const { limit = 50 } = req.query;

    let companionDialogId = null;

    // Сначала проверяем мета-тег диалога с контактом на наличие ID диалога бота
    try {
      const clientDialog = await chat3Client.getDialog(clientDialogId);
      const clientDialogData = clientDialog?.data || clientDialog;
      companionDialogId = clientDialogData?.meta?.companionBotDialogId?.value || 
                          clientDialogData?.meta?.companionBotDialogId;

      if (companionDialogId) {
        console.log(`Найден ID диалога с ботом в мета-теге: ${companionDialogId}`);
      }
    } catch (error) {
      console.warn(`Не удалось получить диалог с контактом ${clientDialogId}:`, error.message);
    }

    // Если мета-тега нет, ищем по старому способу
    if (!companionDialogId) {
      const { managerUserId } = req.app.locals;
      const filter = `(meta.clientDialogId,eq,${JSON.stringify(clientDialogId)})&(meta.type,eq,companion_bot)`;
      
      const dialogs = await chat3Client.getUserDialogs(managerUserId, {
        filter: filter,
        limit: 1
      });

      const dialogsData = dialogs?.data || dialogs || [];
      const companionDialog = dialogsData.length > 0 ? dialogsData[0] : null;

      if (!companionDialog) {
        return res.json({
          success: true,
          data: []
        });
      }

      companionDialogId = companionDialog.dialogId;
    }

    // Получаем сообщения из диалога с ботом
    // Сортируем по createdAt по возрастанию (старые сверху, новые снизу)
    const params = {
      limit: parseInt(limit),
      sort: JSON.stringify({ createdAt: 1 }) // JSON строка, как ожидает API
    };
    const messages = await chat3Client.getDialogMessages(companionDialogId, params);

    const messagesData = messages?.data || messages || [];

    res.json({
      success: true,
      data: messagesData
    });
  } catch (error) {
    console.error('Ошибка при получении подсказок от бота:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}

export async function sendCompanionMessage(req, res) {
  try {
    const { chat3Client, managerUserId, broadcast } = req.app.locals;
    const { companionDialogId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Содержимое сообщения обязательно'
      });
    }

    // Отправляем сообщение от имени менеджера в диалог с ботом
    const message = await chat3Client.createMessage(companionDialogId, {
      senderId: managerUserId,
      type: 'internal.text',
      content: content
    });

    const messageData = message?.data || message;

    // Отправляем обновление через WebSocket
    if (broadcast) {
      broadcast({
        type: 'message.created',
        dialogId: companionDialogId,
        message: messageData
      });
    }

    res.json({
      success: true,
      data: messageData
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения в диалог с ботом:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}
