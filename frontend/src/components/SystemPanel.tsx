import { useEffect, useRef, useState } from "react";
import type { CommandLogEntry } from "../interfaces/command";
import type {
  AltitudeTrendProps,
  CompassRoseProps,
  MissionClockProps,
  SystemPanelProps,
} from "../interfaces/components";
import type { CommandType } from "../hooks/useCommand";
import SectionHeader from "./SectionHeader";
import FlightLogSection from "./FlightLogSection";
import PreflightChecklist from "./PreflightChecklist";
import { BLANK_VALUE, formatUtcTime } from "../utils/formatters";

function MissionClock({ started }: MissionClockProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (started && !startRef.current) {
      startRef.current = Date.now();
    }
  }, [started]);

  useEffect(() => {
    if (!startRef.current) return;

    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [started]);

  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");

  return (
    <span className="text-neon font-bold tabular-nums tracking-widest">
      {h}:{m}:{s}
    </span>
  );
}

function AltitudeTrend({ history }: AltitudeTrendProps) {
  if (history.length < 2) return <span className="text-muted">─</span>;

  const last = history[history.length - 1]?.altitude ?? 0;
  const prev = history[history.length - 2]?.altitude ?? 0;
  const delta = last - prev;

  if (delta > 0.5) return <span className="text-neon">↑</span>;
  if (delta < -0.5) return <span className="text-caution">↓</span>;
  return <span className="text-muted">→</span>;
}

function CompassRose({ heading }: CompassRoseProps) {
  if (heading == null) return null;

  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const active = dirs[Math.round(heading / 45) % 8];

  return (
    <div className="grid grid-cols-3 gap-0.5 w-16 text-center text-[9px] font-bold">
      {["NW", "N", "NE", "W", "·", "E", "SW", "S", "SE"].map((d) => (
        <span
          key={d}
          className={
            d === active ? "text-neon" : d === "·" ? "text-line" : "text-muted"
          }
        >
          {d}
        </span>
      ))}
    </div>
  );
}

function CommandStatusEntry({ entry }: { entry: CommandLogEntry }) {
  return (
    <div className="py-1 border-b border-line last:border-0">
      <div className="flex items-center justify-between text-[9px]">
        <span className="tabular-nums text-muted">
          {formatUtcTime(entry.updatedAt)}
        </span>
        <span className="text-neon font-bold tracking-wider">
          {entry.commandType}
        </span>
        <span
          className={`font-bold tracking-wider ${statusColorClass(entry.status)}`}
        >
          {entry.status}
        </span>
      </div>
      {entry.detail && (
        <div className="text-[8px] text-muted tracking-wider mt-0.5 leading-tight opacity-60">
          {entry.detail}
        </div>
      )}
    </div>
  );
}

function CommandLog({ log }: { log: CommandLogEntry[] }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between text-[8px] text-muted pb-1 border-b border-line mb-0.5 pr-2">
        <span>TIME (UTC)</span>
        <span className="translate-x-1">CMD</span>
        <span>STATUS</span>
      </div>
      <div className="max-h-[145px] overflow-y-auto pr-1">
        {log.length > 0 ? (
          log.map((entry) => (
            <CommandStatusEntry key={entry.commandId} entry={entry} />
          ))
        ) : (
          <div className="text-[9px] text-muted py-2 tracking-widest uppercase">
            No commands yet
          </div>
        )}
      </div>
    </div>
  );
}

function RssiBar({ value }: { value: number | undefined }) {
  if (value == null) {
    return <span className="text-[10px] text-muted">NO DATA</span>;
  }
  const filled = Math.round(clamp(value, 0, 100) / 20); // 0-5 blocks
  const empty = 5 - filled;
  const color =
    value < 30 ? "text-danger" : value < 60 ? "text-caution" : "text-neon";
  return (
    <span className={`text-[10px] font-bold tracking-wider ${color}`}>
      {"▮".repeat(filled)}
      <span className="text-muted">{"▯".repeat(empty)}</span>
      <span className="ml-1">{value}%</span>
    </span>
  );
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function statusColorClass(status: CommandLogEntry["status"]): string {
  switch (status) {
    case "ACKED":
      return "text-neon";
    case "PENDING":
    case "SENT":
      return "text-caution";
    case "REJECTED":
    case "TIMEOUT":
    case "FAILED":
      return "text-danger";
    default:
      return "text-muted";
  }
}

interface CommandButtonProps {
  label: string;
  commandType: CommandType;
  isSending: boolean;
  colorClass: string;
  onSend: (c: CommandType) => void;
}

function CommandButton({
  label,
  commandType,
  isSending,
  colorClass,
  onSend,
}: CommandButtonProps) {
  return (
    <button
      className={`flex-1 py-1 text-[9px] font-bold tracking-widest border ${colorClass}
        disabled:opacity-40 disabled:cursor-not-allowed hover:bg-elevated transition-colors`}
      onClick={() => onSend(commandType)}
      disabled={isSending}
    >
      {label}
    </button>
  );
}

export default function SystemPanel({
  telemetry: t,
  history,
  connected,
  selectedDroneId,
  hasActiveGeofence,
  activeGeofenceCount,
  onSendCommand,
  isCommandSending,
  commandError,
  commandLog,
  isDriverModeEnabled,
  isDriverModeAvailable,
  onToggleDriverMode,
  driverWaypointCount,
}: SystemPanelProps) {

  return (
    <aside className="w-52 bg-panel border-l border-line flex flex-col shrink-0 overflow-y-auto">
      <div className="px-3 py-2 border-b border-line bg-elevated">
        <span className="text-[10px] font-bold tracking-widest text-neon uppercase">
          ◈ System Status
        </span>
      </div>

      <div className="px-3 py-2 flex flex-col gap-0.5">
        <PreflightChecklist
          connected={connected}
          telemetry={t}
          selectedDroneId={selectedDroneId}
          hasActiveGeofence={hasActiveGeofence}
          activeGeofenceCount={activeGeofenceCount}
        />
        <SectionHeader title="MISSION CLOCK" />
        <div className="py-1 text-sm">
          <MissionClock started={connected && !!t} />
        </div>

        <SectionHeader title="HEADING" />
        <div className="flex items-center gap-3 py-1">
          <CompassRose heading={t?.heading} />
          <div>
            <div className="text-sm font-bold text-neon tabular-nums">
              {t?.heading != null ? `${t.heading.toFixed(1)}°` : BLANK_VALUE}
            </div>
          </div>
        </div>

        <SectionHeader title="ALT TREND" />
        <div className="flex items-center gap-2 py-1">
          <span className="text-xl">
            <AltitudeTrend history={history} />
          </span>
          <div className="text-xs text-neon font-bold tabular-nums">
            {t?.altitude?.toFixed(0) ?? BLANK_VALUE}
            <span className="text-[9px] text-muted ml-0.5">m</span>
          </div>
        </div>

        <SectionHeader title="DATALINK" />
        <div className="py-1 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">
              STATUS
            </span>
            <span
              className={`font-bold text-[10px] ${connected ? "text-neon" : "text-danger animate-blink"}`}
            >
              {connected ? "● NOMINAL" : "○ LOST"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">
              PROTOCOL
            </span>
            <span className="text-neon text-[10px]">STOMP/WS</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">
              RF LINK
            </span>
            <RssiBar value={t?.rssi} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">ARMED</span>
            <span
              className={`font-bold text-[10px] ${
                t?.isArmed === true
                  ? "text-danger animate-blink"
                  : t?.isArmed === false
                    ? "text-neon"
                    : "text-muted"
              }`}
            >
              {t?.isArmed === true
                ? "⚠ ARMED"
                : t?.isArmed === false
                  ? "SAFE"
                  : BLANK_VALUE}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted text-[10px] tracking-wider">MODE</span>
            <span className="text-neon text-[10px] font-bold tracking-wider">
              {t?.flightMode ?? BLANK_VALUE}
            </span>
          </div>
        </div>

        <SectionHeader title="COMMANDS" />
        <div className="py-1 space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <CommandButton
              label="TAKEOFF"
              commandType="TAKEOFF"
              isSending={isCommandSending}
              colorClass="border-neon text-neon"
              onSend={onSendCommand}
            />
            <CommandButton
              label="RTH"
              commandType="RTH"
              isSending={isCommandSending}
              colorClass="border-caution text-caution"
              onSend={onSendCommand}
            />
            <CommandButton
              label="ARM"
              commandType="ARM"
              isSending={isCommandSending}
              colorClass="border-danger text-danger"
              onSend={onSendCommand}
            />
            <CommandButton
              label="DISARM"
              commandType="DISARM"
              isSending={isCommandSending}
              colorClass="border-line text-muted"
              onSend={onSendCommand}
            />
          </div>
          <button
            className={`w-full py-1 text-[9px] font-bold tracking-widest border transition-colors ${
              isDriverModeEnabled
                ? "border-neon text-neon bg-elevated"
                : isDriverModeAvailable
                  ? "border-line text-muted hover:bg-elevated"
                  : "border-line text-muted opacity-50 cursor-not-allowed"
            }`}
            onClick={onToggleDriverMode}
            disabled={isCommandSending || !isDriverModeAvailable}
          >
            DRIVER MODE
          </button>
          {isDriverModeEnabled && (
            <div className="text-[9px] text-caution tracking-widest">
              L-CLICK MAP TO ADD WAYPOINTS ({driverWaypointCount}) — AIRBORNE
              REQUIRED
            </div>
          )}
          {commandError && (
            <div className="text-[9px] text-danger tracking-widest pt-0.5">
              ⚠ {commandError}
            </div>
          )}
          {isCommandSending && (
            <div className="text-[9px] text-caution tracking-widest animate-pulse">
              SENDING...
            </div>
          )}
        </div>

        <FlightLogSection history={history} />

        <SectionHeader title="COMMAND LOG" />
        <CommandLog log={commandLog} />
      </div>
    </aside>
  );
}
