import { useEffect, useRef, useState } from 'react';
import { NAVIGATION_DIRECTION_ALL } from '../constants/navigation';
import type { HeaderProps } from '../interfaces/components';
import type { NavigationDirection } from '../interfaces/telemetry';

// Compass rose layout: row-major 3×3 grid, null = empty center cell
const COMPASS_ROSE: (NavigationDirection | null)[][] = [
  ['NW', 'N',  'NE'],
  ['W',  null, 'E' ],
  ['SW', 'S',  'SE'],
];

function UtcClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums">{time}</span>;
}

export default function Header({
  connected,
  selectedDrone,
  freeMode,
  isLiveVideoOpen,
  showAllAssets,
  selectedNavigationDirection,
  isMissionModeEnabled,
  isGeofenceModeEnabled,
  isReplayModeEnabled,
  onToggleFreeMode,
  onDeselect,
  onToggleLiveVideo,
  onToggleShowAllAssets,
  onSelectNavigationDirection,
  onToggleMissionMode,
  onToggleGeofenceMode,
  onToggleReplayMode,
  onLogout,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isNavigationFilterOpen, setIsNavigationFilterOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedDrone) {
      setSettingsOpen(false);
    }
  }, [selectedDrone]);

  useEffect(() => {
    if (!settingsOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!settingsRef.current || settingsRef.current.contains(event.target as Node)) return;
      setSettingsOpen(false);
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) {
      setIsNavigationFilterOpen(false);
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (!freeMode || !showAllAssets) {
      setIsNavigationFilterOpen(false);
    }
  }, [freeMode, showAllAssets]);

  return (
    <header className="flex items-center justify-between px-4 h-11 bg-panel border-b border-line shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-neon text-xs font-bold tracking-widest">▌▌▌</span>
          <span className="text-neon text-sm font-bold tracking-widest uppercase">
            SHERLOCK GCS
          </span>
        </div>
        <div className="w-px h-5 bg-line" />
        <span className="text-muted text-xs tracking-wider uppercase">
          SHERLOCK Ground Control System
        </span>
      </div>

      <div className="text-caution text-xs font-bold tracking-widest uppercase animate-blink">
        ◈ TRAINING MODE ◈
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted tracking-wider">UTC</span>
          <span className="text-neon font-bold tabular-nums tracking-wider">
            <UtcClock />
          </span>
        </div>

        <div className="w-px h-5 bg-line" />

        {selectedDrone ? (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-1.5 h-1.5 ${
                  connected ? 'bg-neon animate-pulse-fast' : 'bg-caution animate-blink'
                }`}
              />
              <span className={`font-bold tracking-wider ${connected ? 'text-neon' : 'text-caution'}`}>
                {connected ? 'LINK ACTIVE' : 'CONNECTING...'}
              </span>
            </div>

            <div className="w-px h-5 bg-line" />

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted tracking-wider">
                <span className="text-neon">{selectedDrone}</span>
              </span>
              <div ref={settingsRef} className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  className={`text-[9px] tracking-widest border px-1.5 py-0.5 transition-colors ${
                    settingsOpen ? 'text-neon border-neon' : 'text-muted border-line hover:text-neon hover:border-neon'
                  }`}
                  title="Settings"
                >
                  SETTINGS
                </button>
                <button
                  type="button"
                  onClick={onDeselect}
                  className="text-[9px] text-muted tracking-widest border border-line px-1.5 py-0.5 hover:text-danger hover:border-danger transition-colors"
                  title="Deselect drone"
                >
                  ✕
                </button>

                {settingsOpen && (
                  <div className="absolute right-0 top-6 w-44 bg-panel border border-line p-2 z-20 flex flex-col gap-1">
                    <button
                      id="free-mode-toggle-btn"
                      type="button"
                      onClick={onToggleFreeMode}
                      className={`w-full text-left text-[9px] tracking-widest border px-2 py-1 transition-colors ${
                        freeMode
                          ? 'text-neon border-neon bg-elevated'
                          : 'text-muted border-line hover:text-neon hover:border-neon hover:bg-elevated'
                      }`}
                    >
                      FREE MODE: {freeMode ? 'ON' : 'OFF'}
                    </button>
                    {!freeMode && (
                      <>
                        <button
                          id="live-video-toggle-btn"
                          type="button"
                          onClick={onToggleLiveVideo}
                          className={`w-full text-left text-[9px] tracking-widest border px-2 py-1 transition-colors ${
                            isLiveVideoOpen
                              ? 'text-neon border-neon bg-elevated'
                              : 'text-muted border-line hover:text-neon hover:border-neon hover:bg-elevated'
                          }`}
                        >
                          LIVE VIDEO: {isLiveVideoOpen ? 'ON' : 'OFF'}
                        </button>
                        <button
                          id="mission-mode-toggle-btn"
                          type="button"
                          onClick={onToggleMissionMode}
                          className={`w-full text-left text-[9px] tracking-widest border px-2 py-1 transition-colors ${
                            isMissionModeEnabled
                              ? 'text-caution border-caution bg-elevated'
                              : 'text-muted border-line hover:text-caution hover:border-caution hover:bg-elevated'
                          }`}
                          >
                          MISSION PLAN: {isMissionModeEnabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          id="geofence-mode-toggle-btn"
                          type="button"
                          onClick={onToggleGeofenceMode}
                          className={`w-full text-left text-[9px] tracking-widest border px-2 py-1 transition-colors ${
                            isGeofenceModeEnabled
                              ? 'text-caution border-caution bg-elevated'
                              : 'text-muted border-line hover:text-caution hover:border-caution hover:bg-elevated'
                          }`}
                        >
                          GEOFENCE DRAW: {isGeofenceModeEnabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          id="flight-replay-mode-toggle-btn"
                          type="button"
                          onClick={onToggleReplayMode}
                          className={`w-full text-left text-[9px] tracking-widest border px-2 py-1 transition-colors ${
                            isReplayModeEnabled
                              ? 'text-neon border-neon bg-elevated'
                              : 'text-muted border-line hover:text-neon hover:border-neon hover:bg-elevated'
                          }`}
                        >
                          FLIGHT REPLAY: {isReplayModeEnabled ? 'ON' : 'OFF'}
                        </button>
                      </>
                    )}
                    {freeMode && (
                      <>
                        <button
                          id="show-all-assets-btn"
                          type="button"
                          onClick={onToggleShowAllAssets}
                          className={`w-full text-left text-[9px] tracking-widest border px-2 py-1 transition-colors ${
                            showAllAssets
                              ? 'text-neon border-neon bg-elevated'
                              : 'text-muted border-line hover:text-neon hover:border-neon hover:bg-elevated'
                          }`}
                        >
                          SHOW ASSET: {showAllAssets ? 'ALL' : 'PARTICULAR'}
                        </button>

                        {showAllAssets && (
                          <>
                            <button
                              id="show-assets-by-naw-btn"
                              type="button"
                              onClick={() => setIsNavigationFilterOpen((open) => !open)}
                              className={`w-full text-left text-[9px] tracking-widest border px-2 py-1 transition-colors ${
                                selectedNavigationDirection === NAVIGATION_DIRECTION_ALL
                                  ? 'text-muted border-line hover:text-neon hover:border-neon hover:bg-elevated'
                                  : 'text-neon border-neon bg-elevated'
                              }`}
                            >
                              SHOW ASSETS BY NAW
                            </button>

                            {isNavigationFilterOpen && (
                              <div className="flex flex-col gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => onSelectNavigationDirection(NAVIGATION_DIRECTION_ALL)}
                                  className={`w-full text-[9px] tracking-widest border px-1 py-1 transition-colors ${
                                    selectedNavigationDirection === NAVIGATION_DIRECTION_ALL
                                      ? 'text-neon border-neon bg-elevated'
                                      : 'text-muted border-line hover:text-neon hover:border-neon hover:bg-elevated'
                                  }`}
                                >
                                  ALL
                                </button>
                                <div className="grid grid-cols-3 gap-1">
                                  {COMPASS_ROSE.flat().map((direction, index) =>
                                    direction ? (
                                      <button
                                        key={direction}
                                        type="button"
                                        onClick={() => onSelectNavigationDirection(direction)}
                                        className={`text-[9px] tracking-widest border px-1 py-1 transition-colors ${
                                          selectedNavigationDirection === direction
                                            ? 'text-neon border-neon bg-elevated'
                                            : 'text-muted border-line hover:text-neon hover:border-neon hover:bg-elevated'
                                        }`}
                                      >
                                        {direction}
                                      </button>
                                    ) : (
                                      <div key={index} />
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onLogout}
            className="text-[9px] text-muted tracking-widest border border-line px-1.5 py-0.5 hover:text-danger hover:border-danger transition-colors"
            title="Log out"
          >
            LOG OUT
          </button>
        )}
      </div>
    </header>
  );
}
