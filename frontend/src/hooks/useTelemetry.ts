import { useEffect, useRef, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {
  BATTERY_ALERT_TOPIC,
  BATTERY_CRITICAL_THRESHOLD,
  BATTERY_WARN_THRESHOLD,
  COMMAND_LOG_LIMIT,
  COMMAND_TOPIC_PREFIX,
  FLEET_LITE_TOPIC,
  GEOFENCE_ALERT_HISTORY_LIMIT,
  GEOFENCE_ALERT_TOPIC,
  TELEMETRY_HISTORY_LIMIT,
} from '../constants/telemetry';
import type { CommandLogEntry } from '../interfaces/command';
import type { UseTelemetryResult } from '../interfaces/hooks';
import type { GeofenceAlert } from '../interfaces/geofence';
import type { LowBatteryAlert, TelemetryByDrone, TelemetryPoint } from '../interfaces/telemetry';
import {
  parseBatteryAlertMessage,
  parseCommandHistoryResponse,
  parseCommandLifecycleMessage,
  parseGeofenceAlertMessage,
  parseTelemetryListMessage,
  parseTelemetryMessage,
} from '../utils/telemetry';
import { useAuth } from './useAuth';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws-skytrack';
const COMMAND_HISTORY_PATH = (droneId: string) => `/api/drones/${droneId}/commands?limit=${COMMAND_LOG_LIMIT}`;

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
  const [batteryAlertMap, setBatteryAlertMap] = useState<Record<string, LowBatteryAlert>>({});
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const geofenceAlertKeysRef = useRef<string[]>([]);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const resetState = () => {
      setConnected(false);
      setTelemetry(null);
      setFleetTelemetry({});
      setHistory([]);
      setBatteryAlertMap({});
      setGeofenceAlerts([]);
      setCommandLog([]);
      geofenceAlertKeysRef.current = [];
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

    const handleBatteryAlertMessage = (message: IMessage) => {
      const alert = parseBatteryAlertMessage(message.body);
      if (!alert) {
        return;
      }

      setBatteryAlertMap((previous) => {
        if (alert.battery >= BATTERY_WARN_THRESHOLD) {
          const { [alert.droneId]: _removed, ...rest } = previous;
          return rest;
        }
        return {
          ...previous,
          [alert.droneId]: {
            droneId: alert.droneId,
            battery: alert.battery,
            isCritical: alert.battery < BATTERY_CRITICAL_THRESHOLD,
          },
        };
      });
    };

    const handleGeofenceAlertMessage = (message: IMessage) => {
      const alert = parseGeofenceAlertMessage(message.body);
      if (!alert) {
        return;
      }
      if (!droneId || alert.droneId !== droneId) {
        return;
      }

      const alertKey = `${alert.droneId}:${alert.geofenceId}:${alert.eventType}:${alert.timestamp}`;
      if (geofenceAlertKeysRef.current.includes(alertKey)) {
        return;
      }

      geofenceAlertKeysRef.current = [alertKey, ...geofenceAlertKeysRef.current]
        .slice(0, GEOFENCE_ALERT_HISTORY_LIMIT);

      setGeofenceAlerts((previousAlerts) => {
        const nextAlerts = [alert, ...previousAlerts];
        return nextAlerts.length > GEOFENCE_ALERT_HISTORY_LIMIT
          ? nextAlerts.slice(0, GEOFENCE_ALERT_HISTORY_LIMIT)
          : nextAlerts;
      });
    };

    const handleFleetTelemetryMessage = (message: IMessage) => {
      const fleetUpdate = parseTelemetryListMessage(message.body);
      if (fleetUpdate.length === 0) {
        return;
      }

      setFleetTelemetry((previousFleetTelemetry) => {
        const nextFleetTelemetry = { ...previousFleetTelemetry };
        for (const point of fleetUpdate) {
          const previous = nextFleetTelemetry[point.droneId];
          // Lite payloads omit battery and speed — keep values from the full stream if present.
          nextFleetTelemetry[point.droneId] = {
            ...point,
            battery: point.battery ?? previous?.battery,
            speed: point.speed ?? previous?.speed,
          };
        }
        return nextFleetTelemetry;
      });
    };

    const upsertCommandLog = (entry: CommandLogEntry) => {
      setCommandLog((previous) => {
        const merged = new Map<string, CommandLogEntry>();
        for (const item of previous) {
          merged.set(item.commandId, item);
        }
        merged.set(entry.commandId, entry);

        return Array.from(merged.values())
          .sort((left, right) => Date.parse(right.requestedAt) - Date.parse(left.requestedAt))
          .slice(0, COMMAND_LOG_LIMIT);
      });
    };

    const handleCommandLifecycleMessage = (message: IMessage) => {
      const commandUpdate = parseCommandLifecycleMessage(message.body);
      if (!commandUpdate) {
        return;
      }
      if (!droneId || commandUpdate.droneId !== droneId) {
        return;
      }
      upsertCommandLog(commandUpdate);
    };

    if (!droneId || !authToken) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      resetState();
      return;
    }

    setCommandLog([]);

    const bootstrapController = new AbortController();
    const fetchCommandHistory = async () => {
      try {
        const response = await fetch(COMMAND_HISTORY_PATH(droneId), {
          headers: {
            Authorization: `Bearer ${authToken.token}`,
          },
          signal: bootstrapController.signal,
        });
        if (response.status === 401) {
          logout();
          return;
        }
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        const entries = parseCommandHistoryResponse(payload)
          .sort((left, right) => Date.parse(right.requestedAt) - Date.parse(left.requestedAt))
          .slice(0, COMMAND_LOG_LIMIT);
        setCommandLog(entries);
      } catch {
        // Bootstrap failure must not block telemetry subscriptions.
      }
    };
    void fetchCommandHistory();

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
          client.subscribe(BATTERY_ALERT_TOPIC, handleBatteryAlertMessage);
        }
        client.subscribe(GEOFENCE_ALERT_TOPIC, handleGeofenceAlertMessage);
        client.subscribe(`${COMMAND_TOPIC_PREFIX}${droneId}`, handleCommandLifecycleMessage);
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
      bootstrapController.abort();
      client.deactivate();
      clientRef.current = null;
    };
  }, [droneId, freeMode, showAllAssets, authToken, logout]);

  const batteryAlerts = Object.values(batteryAlertMap).sort((a, b) => a.battery - b.battery);

  return { telemetry, fleetTelemetry, connected, history, batteryAlerts, geofenceAlerts, commandLog };
}
