import type { LowBatteryWindowProps } from '../interfaces/components';

const MAX_LIST_HEIGHT_PX = 240;

export default function LowBatteryWindow({ alerts }: LowBatteryWindowProps) {
  const hasCritical = alerts.some((alert) => alert.isCritical);

  return (
    <div className="absolute bottom-12 right-4 z-20 w-56 bg-panel border border-danger shadow-[0_0_0_1px_rgba(255,59,48,0.15)]">
      <div className="px-3 py-2 bg-elevated border-b border-line flex items-center justify-between">
        <span className={`text-[10px] font-bold tracking-widest uppercase ${hasCritical ? 'text-danger animate-blink' : 'text-caution'}`}>
          ⚠ POWER ALERTS
        </span>
        <span className={`text-[9px] font-bold tracking-widest tabular-nums ${hasCritical ? 'text-danger' : 'text-caution'}`}>
          {alerts.length}
        </span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: `${MAX_LIST_HEIGHT_PX}px` }}>
        {alerts.map(({ droneId, battery, isCritical }) => (
          <div
            key={droneId}
            className="flex items-center justify-between px-3 py-2 border-b border-line last:border-b-0"
          >
            <span className="text-[10px] font-bold tracking-widest text-neon">{droneId}</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold tabular-nums ${
                  isCritical ? 'text-danger animate-blink' : 'text-caution'
                }`}
              >
                {battery.toFixed(1)}%
              </span>
              <span
                className={`text-[8px] tracking-widest ${isCritical ? 'text-danger' : 'text-caution'}`}
              >
                {isCritical ? 'CRIT' : 'WARN'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
