export type PerformanceStage = 0 | 1 | 2;

export const PERFORMANCE_STAGE_NORMAL: PerformanceStage = 0;
export const PERFORMANCE_STAGE_LOW: PerformanceStage = 1;
export const PERFORMANCE_STAGE_MINIMAL_MAP: PerformanceStage = 2;
const PERFORMANCE_STAGE_MAX: PerformanceStage = PERFORMANCE_STAGE_MINIMAL_MAP;

export const PERFORMANCE_STAGE_LABELS: Record<PerformanceStage, string> = {
  0: 'STAGE 0',
  1: 'STAGE 1',
  2: 'STAGE 2',
};

export function getNextPerformanceStage(currentStage: PerformanceStage): PerformanceStage {
  if (currentStage >= PERFORMANCE_STAGE_MAX) {
    return PERFORMANCE_STAGE_NORMAL;
  }

  return (currentStage + 1) as PerformanceStage;
}
