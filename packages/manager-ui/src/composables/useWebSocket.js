import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Composable для работы с WebSocket
 */
export function useWebSocket(onMessage) {
  const ws = ref(null);
  const isConnected = ref(false);
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 секунды

  const connect = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3002/ws`;
      
      console.log('Подключение к WebSocket:', wsUrl);
      ws.value = new WebSocket(wsUrl);

      ws.value.onopen = () => {
        console.log('WebSocket подключен');
        isConnected.value = true;
        reconnectAttempts.value = 0;
      };

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Получено сообщение через WebSocket:', data);
          
          // Сохраняем WebSocket для отладки
          window.__ws__ = ws.value;
          
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('Ошибка при парсинге сообщения WebSocket:', error);
        }
      };

      ws.value.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
        isConnected.value = false;
      };

      ws.value.onclose = () => {
        console.log('WebSocket отключен');
        isConnected.value = false;
        
        // Попытка переподключения
        if (reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++;
          console.log(`Попытка переподключения ${reconnectAttempts.value}/${maxReconnectAttempts}...`);
          setTimeout(connect, reconnectDelay);
        } else {
          console.error('Достигнуто максимальное количество попыток переподключения');
        }
      };
    } catch (error) {
      console.error('Ошибка при создании WebSocket соединения:', error);
    }
  };

  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
      isConnected.value = false;
    }
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    ws,
    isConnected,
    connect,
    disconnect
  };
}
