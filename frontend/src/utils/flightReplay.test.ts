import { describe, expect, it } from 'vitest';
import { buildFlightReplayCsv, buildFlightReplayFileName } from './flightReplay';

describe('flight replay csv', () => {
  it('creates csv with header and telemetry row', () => {
    const csv = buildFlightReplayCsv([
      {
        droneId: 'SHERLOCK-01',
        latitude: 37.1,
        longitude: 23.1,
        altitude: 1000,
        speed: 120,
        battery: 80,
        heading: 180,
        timestamp: '2026-04-15T00:00:00Z',
        flightMode: 'AUTO',
      },
    ]);

    expect(csv.startsWith('timestamp,droneId,latitude,longitude')).toBe(true);
    expect(csv).toContain('2026-04-15T00:00:00Z,SHERLOCK-01,37.1,23.1,1000,120,80,180');
  });

  it('sanitizes export filename', () => {
    const fileName = buildFlightReplayFileName(
      'MAVLINK-01',
      '2026-04-15T08:00:00.000Z',
      '2026-04-15T09:00:00.000Z',
    );

    expect(fileName).toBe(
      'flight-replay-MAVLINK-01-2026-04-15T08-00-00-000Z-2026-04-15T09-00-00-000Z.csv',
    );
  });
});
