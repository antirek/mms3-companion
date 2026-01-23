/**
 * Контроллер для работы с диалогами
 */
export async function getManagerDialogs(req, res) {
  try {
    const { chat3Client, managerUserId } = req.app.locals;

    // Получаем диалоги менеджера, исключая диалоги с ботом-компаньоном
    const filter = `(meta.type,ne,companion_bot)`;
    
    // Используем правильный формат для sort: (field,direction)
    const dialogs = await chat3Client.getUserDialogs(managerUserId, {
      filter: filter,
      limit: 100,
      includeLastMessage: true,
      sort: '(lastInteractionAt,desc)'
    });

    const dialogsData = dialogs?.data || dialogs || [];

    res.json({
      success: true,
      data: dialogsData
    });
  } catch (error) {
    console.error('Ошибка при получении диалогов менеджера:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}

export async function getDialog(req, res) {
  try {
    const { chat3Client } = req.app.locals;
    const { dialogId } = req.params;

    const dialog = await chat3Client.getDialog(dialogId);
    const dialogData = dialog?.data || dialog;

    res.json({
      success: true,
      data: dialogData
    });
  } catch (error) {
    console.error('Ошибка при получении диалога:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}

