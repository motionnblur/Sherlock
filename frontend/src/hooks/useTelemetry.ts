import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { FLEET_LITE_TOPIC, TELEMETRY_HISTORY_LIMIT } from '../constants/telemetry';
import type { UseTelemetryResult } from '../interfaces/hooks';
import type { TelemetryByDrone, TelemetryPoint } from '../interfaces/telemetry';
import { parseTelemetryListMessage, parseTelemetryMessage } from '../utils/telemetry';
import { useAuth } from './useAuth';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws-skytrack';

/**
 * Manages the STOMP/SockJS WebSocket connection and exposes live telemetry state.
 * Connects only when a selected drone ID is available.
 * JWT is injected into the STOMP CONNECT headers for server-side validation.
 */
export function useTelemetry(droneId: string | null, freeMode = false, showAllAssets = false): UseTelemetryResult {
  const { authToken, logout } = useAuth();
  const [telemetry, setTelemetry] = useState<TelemetryPoint | null>(null);
  const [fleetTelemetry, setFleetTelemetry] = useState<TelemetryByDrone>({});
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const resetState = () => {
      setConnected(false);
      setTelemetry(null);
      setFleetTelemetry({});
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
      setFleetTelemetry((previousFleetTelemetry) => ({
        ...previousFleetTelemetry,
        [nextTelemetry.droneId]: nextTelemetry,
      }));
      appendHistory(nextTelemetry);
    };

    const handleFleetTelemetryMessage = (message: IMessage) => {
      const fleetUpdate = parseTelemetryListMessage(message.body);
      if (fleetUpdate.length === 0) {
        return;
      }

      setFleetTelemetry((previousFleetTelemetry) => {
        const nextFleetTelemetry = { ...previousFleetTelemetry };
        for (const point of fleetUpdate) {
          nextFleetTelemetry[point.droneId] = point;
        }
        return nextFleetTelemetry;
      });
    };

    if (!droneId || !authToken) {
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
      connectHeaders: {
        Authorization: `Bearer ${authToken.token}`,
      },

      onConnect: () => {
        setConnected(true);
        if (!droneId) {
          return;
        }

        client.subscribe(`/topic/telemetry/${droneId}`, handleTelemetryMessage);
        if (freeMode && showAllAssets) {
          client.subscribe(FLEET_LITE_TOPIC, handleFleetTelemetryMessage);
        }
      },

      onDisconnect: () => setConnected(false),

      onStompError: (frame) => {
        const errorMessage = frame.headers?.message ?? '';
        console.error('[STOMP] Error:', errorMessage);

        // Token rejected by server — force logout rather than looping reconnect attempts.
        if (errorMessage.includes('Invalid') || errorMessage.includes('revoked') || errorMessage.includes('Authorization')) {
          logout();
        }

        setConnected(false);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [droneId, freeMode, showAllAssets, authToken, logout]);

  return { telemetry, fleetTelemetry, connected, history };
}
