import SectionHeader from './SectionHeader';
import { BLANK_VALUE, formatUtcTime } from '../utils/formatters';
import type { FlightLogSectionProps, LogEntryProps } from '../interfaces/components';

function LogEntry({ entry, index }: LogEntryProps) {
  const time = formatUtcTime(entry.timestamp);

  return (
    <div
      className={`flex items-center justify-between py-0.5 text-[9px] border-b border-line last:border-0 ${
        index === 0 ? 'text-neon' : 'text-muted'
      }`}
    >
      <span className="tabular-nums">{time}</span>
      <span className="tabular-nums">
        {entry.altitude?.toFixed(0) ?? BLANK_VALUE}m
      </span>
      <span className="tabular-nums">
        {entry.speed?.toFixed(0) ?? BLANK_VALUE}km/h
      </span>
    </div>
  );
}

export default function FlightLogSection({ history }: FlightLogSectionProps) {
  const recentLog = [...history].reverse().slice(0, 8);

  return (
    <>
      <SectionHeader title="FLIGHT LOG" />
      <div className="py-0.5">
        <div className="flex items-center justify-between text-[8px] text-muted pb-0.5 border-b border-line mb-0.5">
          <span>TIME (UTC)</span>
          <span>ALT</span>
          <span>SPD</span>
        </div>
        {recentLog.length > 0 ? (
          recentLog.map((entry, index) => (
            <LogEntry key={index} entry={entry} index={index} />
          ))
        ) : (
          <span className="text-[9px] text-muted">AWAITING DATA...</span>
        )}
      </div>
    </>
  );
}
