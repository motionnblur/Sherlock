import type { GeofenceAlertWindowProps } from '../interfaces/components';
import { formatUtcTime } from '../utils/formatters';

const MAX_LIST_HEIGHT_PX = 256;

function getEventTone(eventType: string): string {
  return eventType === 'EXIT' ? 'danger' : 'caution';
}

function getToneClassName(tone: string): string {
  return tone === 'danger' ? 'text-danger' : 'text-caution';
}

export default function GeofenceAlertWindow({ alerts }: GeofenceAlertWindowProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 z-20 w-72 bg-panel border border-line shadow-[0_0_0_1px_rgba(255,180,0,0.12)]">
      <div className="px-3 py-2 bg-elevated border-b border-line flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest uppercase text-danger animate-blink">
          ⚠ GEOFENCE ALERTS
        </span>
        <span className="text-[9px] font-bold tracking-widest tabular-nums text-caution">
          {alerts.length}
        </span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: `${MAX_LIST_HEIGHT_PX}px` }}>
        {alerts.map((alert) => {
          const tone = getEventTone(alert.eventType);
          return (
            <div
              key={`${alert.droneId}-${alert.geofenceId}-${alert.eventType}-${alert.timestamp}`}
              className="flex flex-col gap-1 px-3 py-2 border-b border-line last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold tracking-widest text-neon">{alert.droneId}</span>
                <span className={`text-[9px] font-bold tracking-widest ${getToneClassName(tone)}`}>
                  {alert.eventType}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[9px] tracking-widest uppercase">
                <span className="text-muted">{alert.geofenceName}</span>
                <span className={`${getToneClassName(tone)} tabular-nums`}>{formatUtcTime(alert.timestamp)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
