/**
 * Контроллер для работы с диалогами
 */
export async function getManagerDialogs(req, res) {
  try {
    const { chat3Client, managerUserId, companionBotService } = req.app.locals;

    console.log(`[DIALOGS] GET /api/dialogs - запрос списка диалогов менеджера ${managerUserId}`);

    // Получаем диалоги менеджера, исключая диалоги с ботом-компаньоном
    const filter = `(meta.type,ne,companion_bot)`;
    
    console.log(`[DIALOGS] Параметры запроса:`, {
      filter,
      limit: 20,
      includeLastMessage: true,
      sort: '(lastInteractionAt,desc)'
    });
    
    // Используем правильный формат для sort: (field,direction)
    const dialogs = await chat3Client.getUserDialogs(managerUserId, {
      filter: filter,
      limit: 20,
      includeLastMessage: true,
      sort: '(lastInteractionAt,desc)'
    });

    let dialogsData = dialogs?.data || dialogs || [];
    console.log(`[DIALOGS] Получено диалогов: ${dialogsData.length}`);
    
    // Логируем все dialogId для отладки
    const dialogIds = dialogsData.map(d => d.dialogId || d._id || d.id);
    console.log(`[DIALOGS] Dialog IDs:`, dialogIds);
    
    // Проверяем наличие конкретного диалога в списке
    const targetDialogId = 'dlg_pidfhgw2i9llyap28r43';
    const hasTargetDialog = dialogIds.includes(targetDialogId);
    console.log(`[DIALOGS] Проверка диалога ${targetDialogId}:`, hasTargetDialog ? 'найден в списке' : 'НЕ найден в списке (возможно, не попадает в первые 20)');

    // Для каждого диалога проверяем наличие мета-тега companionBotDialogId
    // Если его нет, создаем диалог бот-менеджер
    let needRefresh = false;
    if (companionBotService) {
      const creationPromises = [];
      
      for (const dialog of dialogsData) {
        const dialogId = dialog.dialogId || dialog._id || dialog.id;
        const dialogMeta = dialog.meta || {};
        
        // Проверяем наличие companionBotDialogId в мета-тегах
        const companionBotDialogId = dialogMeta.companionBotDialogId?.value || 
                                     dialogMeta.companionBotDialogId;
        
        console.log(`[DIALOGS] Проверка диалога ${dialogId}:`, {
          hasMeta: !!dialogMeta,
          companionBotDialogId: companionBotDialogId || 'отсутствует',
          metaKeys: Object.keys(dialogMeta)
        });
        
        if (!companionBotDialogId) {
          console.log(`[DIALOGS] Диалог ${dialogId} не имеет мета-тега companionBotDialogId, создаем диалог бот-менеджер...`);
          
          // Создаем диалог бот-менеджер и ждем результат
          // Информацию о клиенте получим внутри getOrCreateCompanionDialog из полных данных диалога
          const creationPromise = companionBotService.getOrCreateCompanionDialog(
            dialogId,
            null, // clientUserId - будет определен внутри метода
            null  // clientName - будет определен внутри метода
          ).then(result => {
            if (result.success) {
              console.log(`[DIALOGS] ✅ Диалог бот-менеджер создан для ${dialogId}, companionDialogId: ${result.dialog?.dialogId || result.dialog?._id || result.dialog?.id}`);
              needRefresh = true;
            } else {
              console.error(`[DIALOGS] ❌ Ошибка при создании диалога бот-менеджер для ${dialogId}:`, result.error);
            }
          }).catch(error => {
            console.error(`[DIALOGS] ❌ Ошибка при создании диалога бот-менеджер для ${dialogId}:`, error);
          });
          
          creationPromises.push(creationPromise);
        }
      }
      
      // Ждем завершения всех созданий
      if (creationPromises.length > 0) {
        await Promise.all(creationPromises);
      }
    }

    // Если были созданы новые диалоги, запрашиваем список заново для получения полных данных с мета-тегами
    if (needRefresh) {
      console.log(`[DIALOGS] Обновляем список диалогов для получения полных данных с мета-тегами...`);
      const refreshedDialogs = await chat3Client.getUserDialogs(managerUserId, {
        filter: filter,
        limit: 20,
        includeLastMessage: true,
        sort: '(lastInteractionAt,desc)'
      });
      
      dialogsData = refreshedDialogs?.data || refreshedDialogs || [];
      console.log(`[DIALOGS] ✅ Список диалогов обновлен, получено ${dialogsData.length} диалогов`);
    }

    console.log(`[DIALOGS] ✅ GET /api/dialogs - успешно возвращено ${dialogsData.length} диалогов`);
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

    console.log(`[DIALOGS] GET /api/dialogs/${dialogId} - запрос диалога`);

    const dialog = await chat3Client.getDialog(dialogId);
    const dialogData = dialog?.data || dialog;

    console.log(`[DIALOGS] ✅ GET /api/dialogs/${dialogId} - диалог получен`);
    res.json({
      success: true,
      data: dialogData
    });
  } catch (error) {
    console.error(`[DIALOGS] ❌ Ошибка при получении диалога ${req.params.dialogId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}

