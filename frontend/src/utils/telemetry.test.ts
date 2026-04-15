import { describe, expect, it } from 'vitest';
import {
  parseCommandHistoryResponse,
  parseCommandLifecycleMessage,
  parseGeofenceAlertMessage,
  parseGeofenceListResponse,
  parseGeofenceResponse,
} from './telemetry';

describe('geofence parsing', () => {
  it('parses geofence alerts', () => {
    const alert = parseGeofenceAlertMessage(JSON.stringify({
      droneId: 'SHERLOCK-01',
      geofenceId: 7,
      geofenceName: 'ALPHA',
      eventType: 'EXIT',
      latitude: 37.1,
      longitude: 23.2,
      altitude: 1280,
      timestamp: '2026-04-08T00:00:00Z',
    }));

    expect(alert).toEqual({
      droneId: 'SHERLOCK-01',
      geofenceId: 7,
      geofenceName: 'ALPHA',
      eventType: 'EXIT',
      latitude: 37.1,
      longitude: 23.2,
      altitude: 1280,
      timestamp: '2026-04-08T00:00:00Z',
    });
  });

  it('rejects malformed geofence alerts', () => {
    expect(parseGeofenceAlertMessage('{}')).toBeNull();
  });

  it('filters invalid geofence list entries', () => {
    const geofences = parseGeofenceListResponse([
      {
        id: 1,
        name: 'ALPHA',
        isActive: true,
        createdAt: '2026-04-08T00:00:00Z',
        points: [
          { id: 1, sequence: 0, latitude: 37.0, longitude: 23.0 },
          { id: 2, sequence: 1, latitude: 37.0, longitude: 24.0 },
          { id: 3, sequence: 2, latitude: 38.0, longitude: 24.0 },
        ],
      },
      {
        id: 'bad',
        name: 'BROKEN',
      },
    ]);

    expect(geofences).toHaveLength(1);
    expect(geofences[0]?.name).toBe('ALPHA');
  });

  it('accepts backend geofence payloads with active field', () => {
    const geofence = parseGeofenceResponse({
      id: 2,
      name: 'BRAVO',
      active: true,
      createdAt: '2026-04-08T00:00:00Z',
      points: [
        { id: 1, sequence: 0, latitude: 37.0, longitude: 23.0 },
        { id: 2, sequence: 1, latitude: 37.0, longitude: 24.0 },
        { id: 3, sequence: 2, latitude: 38.0, longitude: 24.0 },
      ],
    });

    expect(geofence?.isActive).toBe(true);
  });
});

describe('command lifecycle parsing', () => {
  it('parses single command lifecycle payload', () => {
    const entry = parseCommandLifecycleMessage(JSON.stringify({
      commandId: 'cmd-1',
      droneId: 'MAVLINK-01',
      commandType: 'RTH',
      status: 'ACKED',
      requestedAt: '2026-04-15T00:00:00Z',
      updatedAt: '2026-04-15T00:00:01Z',
      detail: 'COMMAND_ACK ACCEPTED',
    }));

    expect(entry?.status).toBe('ACKED');
    expect(entry?.commandType).toBe('RTH');
  });

  it('filters malformed command history items', () => {
    const parsed = parseCommandHistoryResponse({
      commands: [
        {
          commandId: 'cmd-1',
          droneId: 'MAVLINK-01',
          commandType: 'ARM',
          status: 'SENT',
          requestedAt: '2026-04-15T00:00:00Z',
          updatedAt: '2026-04-15T00:00:01Z',
        },
        {
          commandId: 'bad',
          droneId: 1,
        },
      ],
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.commandId).toBe('cmd-1');
  });
});
