import { describe, expect, it } from 'vitest';
import {
  getNextPerformanceStage,
  PERFORMANCE_STAGE_NORMAL,
  PERFORMANCE_STAGE_LOW,
  PERFORMANCE_STAGE_MINIMAL_MAP,
} from './performance';

describe('getNextPerformanceStage', () => {
  it('advances from NORMAL (0) to LOW (1)', () => {
    expect(getNextPerformanceStage(PERFORMANCE_STAGE_NORMAL)).toBe(PERFORMANCE_STAGE_LOW);
  });

  it('advances from LOW (1) to MINIMAL_MAP (2)', () => {
    expect(getNextPerformanceStage(PERFORMANCE_STAGE_LOW)).toBe(PERFORMANCE_STAGE_MINIMAL_MAP);
  });

  it('wraps from MINIMAL_MAP (2) back to NORMAL (0)', () => {
    expect(getNextPerformanceStage(PERFORMANCE_STAGE_MINIMAL_MAP)).toBe(PERFORMANCE_STAGE_NORMAL);
  });

  it('cycles through all three stages in order', () => {
    let stage = PERFORMANCE_STAGE_NORMAL;
    stage = getNextPerformanceStage(stage);
    expect(stage).toBe(PERFORMANCE_STAGE_LOW);
    stage = getNextPerformanceStage(stage);
    expect(stage).toBe(PERFORMANCE_STAGE_MINIMAL_MAP);
    stage = getNextPerformanceStage(stage);
    expect(stage).toBe(PERFORMANCE_STAGE_NORMAL);
  });
});
