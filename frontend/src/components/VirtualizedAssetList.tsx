import { useMemo, useState, type ReactNode } from 'react';
import type { DroneId } from '../interfaces/telemetry';

interface VirtualizedAssetListProps {
  assetIds: DroneId[];
  viewportHeightPx: number;
  rowHeightPx: number;
  overscanRows: number;
  renderRow: (assetId: DroneId) => ReactNode;
}

export default function VirtualizedAssetList({
  assetIds,
  viewportHeightPx,
  rowHeightPx,
  overscanRows,
  renderRow,
}: VirtualizedAssetListProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = assetIds.length * rowHeightPx;
  const visibleRowCount = Math.ceil(viewportHeightPx / rowHeightPx) + (overscanRows * 2);

  const { startIndex, visibleAssets } = useMemo(() => {
    const nextStartIndex = Math.max(0, Math.floor(scrollTop / rowHeightPx) - overscanRows);
    const endIndex = Math.min(assetIds.length, nextStartIndex + visibleRowCount);
    return {
      startIndex: nextStartIndex,
      visibleAssets: assetIds.slice(nextStartIndex, endIndex),
    };
  }, [assetIds, overscanRows, rowHeightPx, scrollTop, visibleRowCount]);

  return (
    <div
      className="overflow-y-auto"
      style={{ height: `${viewportHeightPx}px` }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${startIndex * rowHeightPx}px)` }}>
          {visibleAssets.map((assetId) => (
            <div key={assetId} style={{ height: `${rowHeightPx}px` }}>
              {renderRow(assetId)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
