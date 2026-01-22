import amqp from 'amqplib';
import { config } from './config.js';

/**
 * Клиент для получения обновлений из RabbitMQ для менеджера
 */
export class RabbitMQUpdatesClient {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.broadcastCallback = null;
  }

  /**
   * Установка callback для broadcast обновлений
   * @param {Function} callback - Функция для отправки обновлений через WebSocket
   */
  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  /**
   * Подключение к RabbitMQ
   */
  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      console.log(`Подключение к RabbitMQ: ${rabbitmqUrl}`);
      
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      // Обработка закрытия соединения
      this.connection.on('close', () => {
        console.warn('Соединение с RabbitMQ закрыто');
        this.isConnected = false;
      });

      this.connection.on('error', (err) => {
        console.error('Ошибка соединения с RabbitMQ:', err);
        this.isConnected = false;
      });

      console.log('Успешно подключено к RabbitMQ');
      return true;
    } catch (error) {
      console.error('Ошибка при подключении к RabbitMQ:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Настройка очереди и подписка на updates для менеджера
   */
  async setupQueue() {
    try {
      if (!this.channel) {
        throw new Error('Канал не создан. Сначала выполните connect()');
      }

      const exchange = process.env.RABBITMQ_UPDATES_EXCHANGE || 'chat3_updates';
      const managerUserId = config.manager.userId;
      const companionBotUserId = config.companionBot?.userId || 'bot_companion';

      // Имя очереди для менеджера
      const queue = `user_${managerUserId}_updates`;
      
      // Routing keys для подписки на updates менеджера и бота-компаньона
      // Подписываемся на все возможные варианты для надежности
      // Формат: update.{category}.{userType}.{userId}.{updateType}
      const routingKeys = [
        // Updates для менеджера
        `update.dialog.user.${managerUserId}.*`,      // Для user типа
        `update.dialog.*.${managerUserId}.*`,         // Для любого типа (wildcard)
        `update.*.user.${managerUserId}.*`,            // Для всех категорий, user типа
        `update.*.*.${managerUserId}.*`,               // Для всех категорий и типов
        // Updates для бота-компаньона (чтобы получать его сообщения в диалогах с менеджером)
        `update.dialog.bot.${companionBotUserId}.*`,   // Для bot типа
        `update.dialog.*.${companionBotUserId}.*`,      // Для любого типа (wildcard)
        `update.*.bot.${companionBotUserId}.*`,         // Для всех категорий, bot типа
        `update.*.*.${companionBotUserId}.*`            // Для всех категорий и типов
      ];

      // Убеждаемся, что очередь существует
      await this.channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // TTL 1 час
        },
      });

      console.log(`Очередь '${queue}' настроена`);

      // Настраиваем exchange для updates chat3
      if (exchange) {
        await this.channel.assertExchange(exchange, 'topic', {
          durable: true,
        });

        // Привязываем очередь к exchange со всеми возможными routing keys
        for (const routingKey of routingKeys) {
          await this.channel.bindQueue(queue, exchange, routingKey);
        }
        console.log(`Exchange '${exchange}' настроен, очередь привязана к routing keys:`, routingKeys);
      }

      // Подписываемся на сообщения из очереди
      await this.channel.consume(
        queue,
        async (msg) => {
          if (msg !== null) {
            try {
              const content = JSON.parse(msg.content.toString());
              console.log('Получен update из очереди для менеджера:', {
                eventType: content.eventType,
                dialogId: content.data?.dialog?.dialogId,
                messageId: content.data?.message?.messageId,
                senderId: content.data?.message?.senderId,
                content: content.data?.message?.content?.substring(0, 50),
              });

              // Обрабатываем update
              await this.handleUpdate(content);

              // Подтверждаем обработку сообщения
              this.channel.ack(msg);
            } catch (error) {
              console.error('Ошибка при обработке update:', error);
              // Отклоняем некорректное сообщение без повторной отправки
              this.channel.nack(msg, false, false);
            }
          }
        },
        {
          noAck: false, // Требуем подтверждения обработки
        }
      );

      console.log(`Подписка на очередь '${queue}' установлена (routing keys: ${routingKeys.join(', ')})`);
    } catch (error) {
      console.error('Ошибка при настройке очереди:', error);
      throw error;
    }
  }

  /**
   * Обработка update из RabbitMQ
   * @param {Object} update - Update из RabbitMQ
   */
  async handleUpdate(update) {
    try {
      const { eventType, data } = update;

      // Обрабатываем только события создания сообщений
      if (eventType === 'message.create' && data && data.message) {
        const message = data.message;
        const dialog = data.dialog;

        // Отправляем ВСЕ сообщения, которые относятся к диалогам менеджера
        // (включая сообщения от клиентов, бота-компаньона и самого менеджера)
        console.log('Получено новое сообщение для менеджера:', {
          dialogId: dialog?.dialogId,
          messageId: message.messageId,
          senderId: message.senderId,
          content: message.content?.substring(0, 50),
        });

        // Отправляем обновление через WebSocket
        if (this.broadcastCallback) {
          console.log('Отправка сообщения через WebSocket:', {
            dialogId: dialog?.dialogId,
            messageId: message.messageId,
            senderId: message.senderId
          });
          this.broadcastCallback({
            type: 'message.created',
            dialogId: dialog?.dialogId,
            message: message,
            dialog: dialog
          });
          console.log('Сообщение отправлено через WebSocket');
        } else {
          console.warn('broadcastCallback не установлен, сообщение не отправлено');
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке update:', error);
    }
  }

  /**
   * Закрытие соединения
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        console.log('Канал закрыт');
      }

      if (this.connection) {
        await this.connection.close();
        console.log('Соединение с RabbitMQ закрыто');
      }

      this.isConnected = false;
    } catch (error) {
      console.error('Ошибка при закрытии соединения:', error);
      throw error;
    }
  }

  /**
   * Проверка состояния соединения
   */
  isReady() {
    return this.isConnected && this.channel !== null;
  }
}
