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
      ws.value = new WebSocket(wsUrl);

      ws.value.onopen = () => {
        isConnected.value = true;
        reconnectAttempts.value = 0;
      };

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('WebSocket parse error:', error);
        }
      };

      ws.value.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
        isConnected.value = false;
      };

      ws.value.onclose = () => {
        isConnected.value = false;
        if (reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++;
          setTimeout(connect, reconnectDelay);
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
