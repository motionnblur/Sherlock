import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { TelemetryPoint } from '../types/telemetry';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws-skytrack';
const MAX_HISTORY = 150;

interface UseTelemetryResult {
  telemetry: TelemetryPoint | null;
  connected: boolean;
  history: TelemetryPoint[];
}

/**
 * Manages the STOMP/SockJS WebSocket connection and exposes live telemetry state.
 * Only connects when `enabled` is true — pass false to disconnect and suppress all data.
 */
export function useTelemetry(enabled = true): UseTelemetryResult {
  const [telemetry, setTelemetry] = useState<TelemetryPoint | null>(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      setConnected(false);
      setTelemetry(null);
      setHistory([]);
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        setConnected(true);
        client.subscribe('/topic/telemetry', (message: IMessage) => {
          const data = JSON.parse(message.body) as TelemetryPoint;
          setTelemetry(data);
          setHistory((prev) => {
            const next = [...prev, data];
            return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
          });
        });
      },

      onDisconnect: () => setConnected(false),

      onStompError: (frame) => {
        console.error('[STOMP] Error:', frame.headers?.message);
        setConnected(false);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [enabled]);

  return { telemetry, connected, history };
}
