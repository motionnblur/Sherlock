import type { GeofenceDrawToolbarProps } from '../interfaces/components';
import { GEOFENCE_MIN_POINT_COUNT } from '../constants/telemetry';

const MIN_NAME_LENGTH = 1;

export default function GeofenceDrawToolbar({
  isEnabled,
  vertexCount,
  draftName,
  isSaving,
  error,
  onUpdateDraftName,
  onFinish,
  onCancel,
}: GeofenceDrawToolbarProps) {
  if (!isEnabled) {
    return null;
  }

  const canFinish = vertexCount >= GEOFENCE_MIN_POINT_COUNT && draftName.trim().length >= MIN_NAME_LENGTH && !isSaving;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[32rem] max-w-[calc(100%-2rem)] bg-panel border border-line shadow-[0_0_0_1px_rgba(255,180,0,0.10)] pointer-events-auto">
      <div className="px-3 py-2 bg-elevated border-b border-line flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-caution">
            ◈ GEOFENCE DRAW MODE
          </div>
          <div className="mt-0.5 text-[9px] tracking-widest text-muted uppercase">
            Left click adds vertices. Finish closes the polygon and saves it.
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] tracking-widest text-muted uppercase">VERTICES</div>
          <div className="text-[10px] font-bold tracking-widest text-neon tabular-nums">
            {vertexCount}
          </div>
        </div>
      </div>

      <div className="px-3 py-2 flex flex-col gap-2">
        <input
          type="text"
          value={draftName}
          onChange={(event) => onUpdateDraftName(event.target.value)}
          placeholder="GEOFENCE NAME"
          className="w-full bg-surface border border-line px-2 py-1 text-[10px] tracking-widest uppercase text-neon placeholder:text-muted focus:outline-none focus:border-caution"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onFinish()}
            disabled={!canFinish}
            className="flex-1 border border-caution text-caution px-2 py-1 text-[10px] tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-elevated transition-colors"
          >
            {isSaving ? 'SAVING...' : 'FINISH'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="border border-line text-muted px-2 py-1 text-[10px] tracking-widest uppercase hover:text-danger hover:border-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            CANCEL
          </button>
        </div>

        {error && (
          <div className="border border-danger bg-elevated px-2 py-1 text-[9px] tracking-widest uppercase text-danger">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
