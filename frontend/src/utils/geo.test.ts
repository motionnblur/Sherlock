import { describe, expect, it } from 'vitest';
import { horizontalDistanceMeters } from './geo';

describe('horizontalDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(horizontalDistanceMeters(37.0, 23.0, 37.0, 23.0)).toBe(0);
  });

  it('approximates 1° latitude ≈ 111 km', () => {
    // One degree of latitude along a meridian is ~111.195 km
    const distance = horizontalDistanceMeters(0, 0, 1, 0);
    expect(distance).toBeCloseTo(111_195, -2);
  });

  it('approximates 1° longitude at the equator ≈ 111 km', () => {
    const distance = horizontalDistanceMeters(0, 0, 0, 1);
    expect(distance).toBeCloseTo(111_195, -2);
  });

  it('is symmetric — A→B equals B→A', () => {
    const ab = horizontalDistanceMeters(37.0, 23.0, 38.5, 24.5);
    const ba = horizontalDistanceMeters(38.5, 24.5, 37.0, 23.0);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('returns a plausible transatlantic distance', () => {
    // New York (40.71, -74.01) → London (51.51, -0.13) ≈ 5,570 km
    const distance = horizontalDistanceMeters(40.7128, -74.006, 51.5072, -0.1276);
    expect(distance).toBeGreaterThan(5_500_000);
    expect(distance).toBeLessThan(5_650_000);
  });

  it('handles antipodal points without NaN', () => {
    const distance = horizontalDistanceMeters(0, 0, 0, 180);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThan(0);
  });

  it('handles negative coordinates', () => {
    const distance = horizontalDistanceMeters(-33.87, 151.21, -43.53, 172.64);
    // Sydney → Christchurch ≈ 2,220 km
    expect(distance).toBeGreaterThan(2_100_000);
    expect(distance).toBeLessThan(2_350_000);
  });
});
