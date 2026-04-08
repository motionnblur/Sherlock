import { describe, expect, it } from 'vitest';
import { parseGeofenceAlertMessage, parseGeofenceListResponse } from './telemetry';

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
});
