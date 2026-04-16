import { useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export function useK8sWatch(namespace: string, onEvent: (data: any) => void) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!namespace) return;

    let reconnectTimeout: number;
    let eventSource: EventSource | null = null;

    const connect = () => {
      console.log(`[SSE] Connecting to namespace watch: ${namespace}`);
      eventSource = new EventSource(`${API_BASE_URL}/watch/namespaces/${namespace}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEventRef.current(data);
        } catch (e) {
          console.error('Error parsing SSE event', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        eventSource?.close();
        
        // Reconnect logic
        reconnectTimeout = window.setTimeout(() => {
          console.log('[SSE] Attempting to reconnect...');
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      console.log(`[SSE] Disconnecting from namespace watch: ${namespace}`);
      clearTimeout(reconnectTimeout);
      if (eventSource) {
        // Closing the EventSource will log a net::ERR_ABORTED in the browser console.
        // This is expected behavior, especially in React 18 Strict Mode which unmounts and remounts components.
        eventSource.close();
      }
    };
  }, [namespace]);
}
