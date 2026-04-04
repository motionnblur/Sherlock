import { AVAILABLE_ASSETS } from '../constants/assets';
import {
  ASSET_LIST_OVERSCAN_ROWS,
  ASSET_LIST_ROW_HEIGHT_PX,
  FREE_MODE_ASSET_LIST_HEIGHT_PX,
} from '../constants/telemetry';
import type { AssetWindowProps } from '../interfaces/components';
import VirtualizedAssetList from './VirtualizedAssetList';

export default function FreeModeAssetWindow({
  selectedDrone,
  onActivateDrone,
}: AssetWindowProps) {
  const assetIds = AVAILABLE_ASSETS;

  return (
    <div className="absolute top-4 left-4 z-20 w-60 h-[18rem] max-h-[calc(100%-2rem)] pointer-events-none">
      <div className="flex h-full flex-col border border-line bg-panel shadow-[0_0_0_1px_rgba(0,255,65,0.08)] pointer-events-auto overflow-hidden">
        <div className="px-3 py-2 bg-elevated border-b border-line">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-neon uppercase">
                ◈ Active Assets
              </div>
              <div className="mt-0.5 text-[9px] tracking-widest text-muted uppercase">
                Free mode selection window
              </div>
            </div>
            <div className="text-[9px] tracking-widest text-muted uppercase">
              {AVAILABLE_ASSETS.length} ONLINE
            </div>
          </div>
        </div>

        <VirtualizedAssetList
          assetIds={assetIds}
          viewportHeightPx={FREE_MODE_ASSET_LIST_HEIGHT_PX}
          rowHeightPx={ASSET_LIST_ROW_HEIGHT_PX}
          overscanRows={ASSET_LIST_OVERSCAN_ROWS}
          renderRow={(assetId) => {
            const isSelected = selectedDrone === assetId;
            return (
              <button
                type="button"
                onClick={() => onActivateDrone(assetId)}
                className={`w-full h-full text-left px-3 py-2 border-b border-line transition-colors ${
                  isSelected ? 'bg-elevated' : 'hover:bg-elevated/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold tracking-widest text-neon">
                    {assetId}
                  </span>
                  <span className={`text-[9px] tracking-widest uppercase ${isSelected ? 'text-neon' : 'text-muted'}`}>
                    {isSelected ? 'ACTIVE' : 'LIVE'}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-3 text-[9px] tracking-widest uppercase text-muted">
                  <span>{isSelected ? 'RESUME TRACKING' : 'CLICK TO ACTIVATE'}</span>
                  <span className="text-line">▸</span>
                </div>
              </button>
            );
          }}
        />

        <div className="px-3 py-2 border-t border-line">
          <span className="text-[8px] tracking-widest text-muted uppercase">
            Select an asset to hand control to that platform
          </span>
        </div>
      </div>
    </div>
  );
}
