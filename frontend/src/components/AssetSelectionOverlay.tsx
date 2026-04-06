import {
  ASSET_LIST_OVERSCAN_ROWS,
  MAX_SELECTION_VISIBLE_ROWS,
  SELECTION_ASSET_ROW_HEIGHT_PX,
} from '../constants/telemetry';
import type { DroneId } from '../interfaces/telemetry';
import VirtualizedAssetList from './VirtualizedAssetList';

interface AssetSelectionOverlayProps {
  droneIds: DroneId[];
  onSelectDrone: (id: DroneId) => void;
}

function AssetRow({
  droneId,
  onSelectDrone,
}: {
  droneId: DroneId;
  onSelectDrone: (id: DroneId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectDrone(droneId)}
      className="w-full h-full text-left border-b border-line px-3 flex items-center justify-between hover:bg-elevated transition-colors"
    >
      <span className="text-xs font-bold text-neon tracking-widest">{droneId}</span>
      <span className="text-[9px] text-muted tracking-widest">▸ TRACK</span>
    </button>
  );
}

export default function AssetSelectionOverlay({ droneIds, onSelectDrone }: AssetSelectionOverlayProps) {
  const viewportHeightPx = Math.min(droneIds.length || 1, MAX_SELECTION_VISIBLE_ROWS) * SELECTION_ASSET_ROW_HEIGHT_PX;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-panel border border-line w-72 pointer-events-auto shadow-[0_0_0_1px_rgba(0,255,65,0.08)]">
        <div className="px-3 py-2 bg-elevated border-b border-line">
          <span className="text-[10px] font-bold tracking-widest text-neon uppercase">
            ◈ SELECT ASSET
          </span>
        </div>

        <VirtualizedAssetList
          assetIds={droneIds}
          viewportHeightPx={viewportHeightPx}
          rowHeightPx={SELECTION_ASSET_ROW_HEIGHT_PX}
          overscanRows={ASSET_LIST_OVERSCAN_ROWS}
          renderRow={(assetId) => (
            <AssetRow droneId={assetId} onSelectDrone={onSelectDrone} />
          )}
        />

        <div className="px-3 py-2 border-t border-line">
          <span className="text-[8px] text-muted tracking-widest">
            SELECT AN ASSET TO BEGIN TRACKING
          </span>
        </div>
      </div>
    </div>
  );
}
