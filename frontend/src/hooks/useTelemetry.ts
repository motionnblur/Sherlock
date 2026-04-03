import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { TELEMETRY_HISTORY_LIMIT } from '../constants/telemetry';
import type { UseTelemetryResult } from '../interfaces/hooks';
import type { TelemetryPoint } from '../interfaces/telemetry';
import { parseTelemetryMessage } from '../utils/telemetry';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws-skytrack';

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
    const resetState = () => {
      setConnected(false);
      setTelemetry(null);
      setHistory([]);
    };

    const appendHistory = (point: TelemetryPoint) => {
      setHistory((previousHistory) => {
        const nextHistory = [...previousHistory, point];
        return nextHistory.length > TELEMETRY_HISTORY_LIMIT
          ? nextHistory.slice(nextHistory.length - TELEMETRY_HISTORY_LIMIT)
          : nextHistory;
      });
    };

    const handleTelemetryMessage = (message: IMessage) => {
      const nextTelemetry = parseTelemetryMessage(message.body);
      if (!nextTelemetry) {
        console.warn('[STOMP] Ignored malformed telemetry payload');
        return;
      }

      setTelemetry(nextTelemetry);
      appendHistory(nextTelemetry);
    };

    if (!enabled) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      resetState();
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        setConnected(true);
        client.subscribe('/topic/telemetry', handleTelemetryMessage);
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
