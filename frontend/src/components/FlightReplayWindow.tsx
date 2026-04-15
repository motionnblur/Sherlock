import type { FlightReplayWindowProps } from '../interfaces/components';
import { formatUtcTime } from '../utils/formatters';

const WINDOW_WIDTH_PX = 320;
const WINDOW_HEIGHT_PX = 286;

export default function FlightReplayWindow({
  selectedDrone,
  rangeStartLocal,
  rangeEndLocal,
  isLoading,
  replayError,
  isPlaying,
  replayPointCount,
  currentIndex,
  currentTimestamp,
  onChangeRangeStart,
  onChangeRangeEnd,
  onLoadReplay,
  onTogglePlayback,
  onSeek,
  onExportCsv,
  onClose,
}: FlightReplayWindowProps) {
  const hasReplayData = replayPointCount > 0;
  const sliderMax = Math.max(0, replayPointCount - 1);

  return (
    <div
      className="absolute bottom-10 left-4 z-50 bg-panel border border-line flex flex-col"
      style={{ width: WINDOW_WIDTH_PX, height: WINDOW_HEIGHT_PX }}
    >
      <div className="flex items-center justify-between px-2 py-1 bg-elevated border-b border-line shrink-0">
        <div className="text-[9px] tracking-widest uppercase text-neon">
          Flight Replay · {selectedDrone}
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-danger text-[10px] leading-none font-bold px-1"
          aria-label="Close flight replay window"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 flex flex-col px-2 py-2 gap-2 text-[9px] tracking-widest">
        <div className="grid grid-cols-1 gap-1">
          <label className="text-muted uppercase" htmlFor="replay-range-start">
            Start (Local)
          </label>
          <input
            id="replay-range-start"
            type="datetime-local"
            value={rangeStartLocal}
            onChange={(event) => onChangeRangeStart(event.target.value)}
            className="bg-surface border border-line px-2 py-1 text-neon focus:outline-none focus:border-neon"
          />
        </div>

        <div className="grid grid-cols-1 gap-1">
          <label className="text-muted uppercase" htmlFor="replay-range-end">
            End (Local)
          </label>
          <input
            id="replay-range-end"
            type="datetime-local"
            value={rangeEndLocal}
            onChange={(event) => onChangeRangeEnd(event.target.value)}
            className="bg-surface border border-line px-2 py-1 text-neon focus:outline-none focus:border-neon"
          />
        </div>

        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={onLoadReplay}
            disabled={isLoading}
            className="col-span-1 border border-neon text-neon py-1 hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
          >
            LOAD
          </button>
          <button
            type="button"
            onClick={onTogglePlayback}
            disabled={!hasReplayData || isLoading}
            className="col-span-1 border border-caution text-caution py-1 hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!hasReplayData || isLoading}
            className="col-span-2 border border-line text-muted py-1 hover:text-neon hover:border-neon hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
          >
            EXPORT CSV
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1">
          <label className="text-muted uppercase" htmlFor="replay-slider">
            Frame {hasReplayData ? `${currentIndex + 1}/${replayPointCount}` : '0/0'}
          </label>
          <input
            id="replay-slider"
            type="range"
            min={0}
            max={sliderMax}
            value={hasReplayData ? currentIndex : 0}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={!hasReplayData || isLoading}
            className="w-full accent-neon disabled:opacity-40"
          />
        </div>

        <div className="border border-line bg-surface px-2 py-1 min-h-[38px]">
          {isLoading && (
            <span className="text-caution uppercase animate-pulse">Loading replay...</span>
          )}
          {!isLoading && replayError && (
            <span className="text-danger uppercase">{replayError}</span>
          )}
          {!isLoading && !replayError && hasReplayData && currentTimestamp && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted uppercase">Cursor UTC</span>
              <span className="text-neon tabular-nums">{formatUtcTime(currentTimestamp)}</span>
            </div>
          )}
          {!isLoading && !replayError && !hasReplayData && (
            <span className="text-muted uppercase">Load range to start replay</span>
          )}
        </div>
      </div>
    </div>
  );
}
