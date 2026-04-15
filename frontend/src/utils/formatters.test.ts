import { describe, expect, it } from 'vitest';
import {
  BLANK_VALUE,
  clamp,
  formatFixed,
  formatHemisphereCoordinate,
  formatCoordinatePair,
  formatUtcTime,
  getCardinalDirection,
} from './formatters';

describe('BLANK_VALUE', () => {
  it('is ---', () => {
    expect(BLANK_VALUE).toBe('---');
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns exact min boundary', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns exact max boundary', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles min equal to max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe('formatFixed', () => {
  it('formats to 2 decimal places by default', () => {
    expect(formatFixed(3.14159)).toBe('3.14');
  });

  it('formats with specified decimal places', () => {
    expect(formatFixed(3.14159, 4)).toBe('3.1416');
  });

  it('formats zero correctly', () => {
    expect(formatFixed(0)).toBe('0.00');
  });

  it('formats negative values', () => {
    expect(formatFixed(-7.5, 1)).toBe('-7.5');
  });

  it('returns BLANK_VALUE for null', () => {
    expect(formatFixed(null)).toBe(BLANK_VALUE);
  });

  it('returns BLANK_VALUE for undefined', () => {
    expect(formatFixed(undefined)).toBe(BLANK_VALUE);
  });

  it('returns custom fallback for null', () => {
    expect(formatFixed(null, 2, 'N/A')).toBe('N/A');
  });
});

describe('formatHemisphereCoordinate', () => {
  it('formats positive value with positive label', () => {
    expect(formatHemisphereCoordinate(37.123456, 'N', 'S')).toBe('37.123456°N');
  });

  it('formats negative value with negative label using absolute value', () => {
    expect(formatHemisphereCoordinate(-37.123456, 'N', 'S')).toBe('37.123456°S');
  });

  it('formats positive longitude with E label', () => {
    expect(formatHemisphereCoordinate(23.456789, 'E', 'W')).toBe('23.456789°E');
  });

  it('formats negative longitude with W label', () => {
    expect(formatHemisphereCoordinate(-23.456789, 'E', 'W')).toBe('23.456789°W');
  });

  it('treats zero as positive', () => {
    expect(formatHemisphereCoordinate(0, 'N', 'S')).toBe('0.000000°N');
  });

  it('respects custom decimal places', () => {
    expect(formatHemisphereCoordinate(37.1234, 'N', 'S', 2)).toBe('37.12°N');
  });

  it('returns BLANK_VALUE for null', () => {
    expect(formatHemisphereCoordinate(null, 'N', 'S')).toBe(BLANK_VALUE);
  });

  it('returns BLANK_VALUE for undefined', () => {
    expect(formatHemisphereCoordinate(undefined, 'N', 'S')).toBe(BLANK_VALUE);
  });
});

describe('formatCoordinatePair', () => {
  it('formats positive lat/lon pair', () => {
    expect(formatCoordinatePair(37.1234, 23.4567)).toBe('37.1234°N, 23.4567°E');
  });

  it('formats negative lat/lon pair', () => {
    expect(formatCoordinatePair(-37.1234, -23.4567)).toBe('37.1234°S, 23.4567°W');
  });

  it('formats mixed hemisphere pair', () => {
    expect(formatCoordinatePair(37.1234, -118.2468)).toBe('37.1234°N, 118.2468°W');
  });

  it('returns BLANK_VALUE when latitude is null', () => {
    expect(formatCoordinatePair(null, 23.4567)).toBe(BLANK_VALUE);
  });

  it('returns BLANK_VALUE when longitude is null', () => {
    expect(formatCoordinatePair(37.1234, null)).toBe(BLANK_VALUE);
  });

  it('returns BLANK_VALUE when both are null', () => {
    expect(formatCoordinatePair(null, null)).toBe(BLANK_VALUE);
  });

  it('uses 4 decimal places by default', () => {
    // 37.12345678 rounded to 4 dp → 37.1235
    expect(formatCoordinatePair(37.12345678, 23.0)).toBe('37.1235°N, 23.0000°E');
  });
});

describe('formatUtcTime', () => {
  it('extracts HH:MM:SS from ISO timestamp', () => {
    expect(formatUtcTime('2026-04-15T14:30:45Z')).toBe('14:30:45');
  });

  it('handles midnight correctly', () => {
    expect(formatUtcTime('2026-04-15T00:00:00Z')).toBe('00:00:00');
  });

  it('returns BLANK_VALUE for null', () => {
    expect(formatUtcTime(null)).toBe(BLANK_VALUE);
  });

  it('returns BLANK_VALUE for undefined', () => {
    expect(formatUtcTime(undefined)).toBe(BLANK_VALUE);
  });

  it('returns BLANK_VALUE for empty string', () => {
    expect(formatUtcTime('')).toBe(BLANK_VALUE);
  });
});

describe('getCardinalDirection', () => {
  it('returns N for 0°', () => {
    expect(getCardinalDirection(0)).toBe('N');
  });

  it('returns NE for 45°', () => {
    expect(getCardinalDirection(45)).toBe('NE');
  });

  it('returns E for 90°', () => {
    expect(getCardinalDirection(90)).toBe('E');
  });

  it('returns SE for 135°', () => {
    expect(getCardinalDirection(135)).toBe('SE');
  });

  it('returns S for 180°', () => {
    expect(getCardinalDirection(180)).toBe('S');
  });

  it('returns SW for 225°', () => {
    expect(getCardinalDirection(225)).toBe('SW');
  });

  it('returns W for 270°', () => {
    expect(getCardinalDirection(270)).toBe('W');
  });

  it('returns NW for 315°', () => {
    expect(getCardinalDirection(315)).toBe('NW');
  });

  it('wraps back to N for 360°', () => {
    expect(getCardinalDirection(360)).toBe('N');
  });

  it('rounds 22° down to N', () => {
    // Math.round(22/45) = 0 → N
    expect(getCardinalDirection(22)).toBe('N');
  });

  it('rounds 23° up to NE', () => {
    // Math.round(23/45) = 1 → NE
    expect(getCardinalDirection(23)).toBe('NE');
  });
});
