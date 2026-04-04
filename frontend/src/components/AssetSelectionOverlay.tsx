import {
  ASSET_LIST_OVERSCAN_ROWS,
  ASSET_LIST_ROW_HEIGHT_PX,
  DRONE_IDS,
  SELECTION_ASSET_LIST_HEIGHT_PX,
} from '../constants/telemetry';
import type { DroneId, TelemetryByDrone } from '../interfaces/telemetry';
import { formatCoordinatePair, formatFixed } from '../utils/formatters';
import VirtualizedAssetList from './VirtualizedAssetList';

interface AssetSelectionOverlayProps {
  lastKnownTelemetry: TelemetryByDrone;
  onSelectDrone: (id: DroneId) => void;
}

function AssetRow({
  droneId,
  lastKnownTelemetry,
  onSelectDrone,
}: {
  droneId: DroneId;
  lastKnownTelemetry: TelemetryByDrone;
  onSelectDrone: (id: DroneId) => void;
}) {
  const lastKnown = lastKnownTelemetry[droneId];

  return (
    <button
      type="button"
      onClick={() => onSelectDrone(droneId)}
      className="w-full h-full text-left border-b border-line px-3 py-2.5 hover:bg-elevated transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-neon tracking-widest">{droneId}</span>
        <span className="text-[9px] text-muted tracking-widest">▸ TRACK</span>
      </div>

      {lastKnown ? (
        <div className="text-[9px] text-muted space-y-0.5 tracking-wider">
          <div className="tabular-nums">{formatCoordinatePair(lastKnown.latitude, lastKnown.longitude)}</div>
          <div className="tabular-nums">
            ALT {formatFixed(lastKnown.altitude, 0)}m
            <span className="mx-1.5 text-line">·</span>
            BAT {formatFixed(lastKnown.battery ?? 0, 1)}%
          </div>
        </div>
      ) : (
        <div className="text-[9px] text-muted tracking-wider animate-pulse-fast">
          FETCHING LAST POSITION...
        </div>
      )}
    </button>
  );
}

export default function AssetSelectionOverlay({
  lastKnownTelemetry,
  onSelectDrone,
}: AssetSelectionOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-panel border border-line w-72 pointer-events-auto shadow-[0_0_0_1px_rgba(0,255,65,0.08)]">
        <div className="px-3 py-2 bg-elevated border-b border-line">
          <span className="text-[10px] font-bold tracking-widest text-neon uppercase">
            ◈ SELECT ASSET
          </span>
        </div>

        <VirtualizedAssetList
          assetIds={DRONE_IDS}
          viewportHeightPx={SELECTION_ASSET_LIST_HEIGHT_PX}
          rowHeightPx={ASSET_LIST_ROW_HEIGHT_PX}
          overscanRows={ASSET_LIST_OVERSCAN_ROWS}
          renderRow={(assetId) => (
            <AssetRow
              droneId={assetId}
              lastKnownTelemetry={lastKnownTelemetry}
              onSelectDrone={onSelectDrone}
            />
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
