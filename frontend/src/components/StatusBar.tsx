import type { StatusBarProps } from '../interfaces/components';
import { PACKET_RATE_LABEL } from '../constants/telemetry';
import { formatCoordinatePair } from '../utils/formatters';

export default function StatusBar({
  telemetry: t,
  connected,
  selectedDrone,
  freeMode,
  lowPerf,
  onToggleLowPerf,
}: StatusBarProps) {
  const battery = t?.battery ?? null;
  const isBatteryLow = battery != null && battery < 20;
  const isBatteryCritical = battery != null && battery < 10;

  return (
    <footer className="flex items-center justify-between px-4 h-7 bg-elevated border-t border-line text-[10px] tracking-wider shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-muted">MISSION</span>
          <span className={`font-bold ${connected && t ? 'text-neon' : 'text-muted'}`}>
            {connected && t ? '● ACTIVE' : '○ STANDBY'}
          </span>
        </div>

        <span className="text-line">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-muted">PLATFORM</span>
          <span className={`font-bold ${selectedDrone ? 'text-neon' : 'text-muted'}`}>
            {selectedDrone ?? 'NO ASSET'}
          </span>
        </div>

        {connected && t && !freeMode && (
          <>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted">POS</span>
              <span className="text-neon tabular-nums">
                {formatCoordinatePair(t.latitude, t.longitude)}
              </span>
            </div>
          </>
        )}

        <span className="text-line">|</span>
        <button
          onClick={onToggleLowPerf}
          className={`font-bold tracking-widest px-2 py-0.5 border border-line ${lowPerf ? 'text-caution bg-panel' : 'text-muted hover:text-neon'}`}
        >
          LOW PERF {lowPerf ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {isBatteryCritical && (
          <span className="text-danger font-bold animate-blink">⚠ CRITICAL BATTERY - RTB IMMEDIATELY</span>
        )}
        {isBatteryLow && !isBatteryCritical && (
          <span className="text-caution font-bold animate-pulse-fast">⚠ LOW BATTERY - {battery?.toFixed(1)}%</span>
        )}
        {!isBatteryLow && connected && t && (
          <span className="text-muted">ALL SYSTEMS NOMINAL</span>
        )}
        {!selectedDrone && (
          <span className="text-muted">SELECT AN ASSET TO BEGIN MISSION</span>
        )}
        {selectedDrone && !connected && (
          <span className="text-danger font-bold animate-blink">⚠ DATALINK LOST - ATTEMPTING RECONNECT</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-muted">PKT RATE</span>
          <span className={selectedDrone ? 'text-neon' : 'text-muted'}>
            {selectedDrone ? PACKET_RATE_LABEL : '─'}
          </span>
        </div>
        <span className="text-line">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted">SYSTEM</span>
          <span className="text-neon">SKYTRACK v1.0</span>
        </div>
      </div>
    </footer>
  );
}
