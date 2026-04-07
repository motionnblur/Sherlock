import { useState } from 'react';
import type { Mission, MissionWaypoint, PlanningWaypoint } from '../interfaces/mission';
import type { DroneId } from '../interfaces/telemetry';
import SectionHeader from './SectionHeader';
import { formatFixed } from '../utils/formatters';

const BLANK_INPUT_NAME = '';

interface MissionPlanningPanelProps {
  selectedDrone: DroneId | null;
  planningWaypoints: PlanningWaypoint[];
  activeMission: Mission | null;
  missions: Mission[];
  isLoading: boolean;
  missionError: string | null;
  onRemovePlanningWaypoint: (localId: number) => void;
  onClearPlanningWaypoints: () => void;
  onSaveMission: (name: string) => Promise<void>;
  onExecuteMission: (missionId: number) => Promise<void>;
  onAbortMission: (missionId: number) => Promise<void>;
  onDeleteMission: (missionId: number) => Promise<void>;
}

type PanelTab = 'plan' | 'saved';

function WaypointStatusDot({ status }: { status: MissionWaypoint['status'] }) {
  const colorClass =
    status === 'REACHED' ? 'text-neon' :
    status === 'ACTIVE'  ? 'text-caution' :
    status === 'SKIPPED' ? 'text-muted' :
    'text-muted';
  const symbol =
    status === 'REACHED' ? '●' :
    status === 'ACTIVE'  ? '◆' :
    '○';
  return <span className={`${colorClass} mr-1`}>{symbol}</span>;
}

function ActiveMissionView({
  mission,
  isLoading,
  onAbort,
}: {
  mission: Mission;
  isLoading: boolean;
  onAbort: () => void;
}) {
  const reached = mission.waypoints.filter((wp) => wp.status === 'REACHED').length;
  const total   = mission.waypoints.length;

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title="ACTIVE MISSION" />
      <div className="px-3 py-2 border-b border-line">
        <div className="text-[10px] text-muted tracking-widest uppercase">MISSION</div>
        <div className="text-sm font-bold text-neon truncate">{mission.name}</div>
        <div className="text-[10px] text-muted mt-0.5">
          DRONE: <span className="text-neon">{mission.droneId ?? '—'}</span>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-line">
        <div className="flex justify-between text-[10px] tracking-widest">
          <span className="text-muted uppercase">PROGRESS</span>
          <span className="text-neon">{reached}/{total}</span>
        </div>
        <div className="w-full h-1 bg-elevated mt-1">
          <div
            className="h-1 bg-neon"
            style={{ width: total > 0 ? `${(reached / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mission.waypoints.map((wp) => (
          <div
            key={wp.id}
            className="flex items-center px-3 py-1.5 border-b border-line text-[10px]"
          >
            <WaypointStatusDot status={wp.status} />
            <span className="text-muted w-5 tabular-nums">{wp.sequence + 1}</span>
            <span className="text-neon tabular-nums flex-1">
              {formatFixed(wp.latitude, 4)}, {formatFixed(wp.longitude, 4)}
            </span>
            <span className="text-muted tabular-nums">{formatFixed(wp.altitude, 0)}m</span>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-line">
        <button
          onClick={onAbort}
          disabled={isLoading}
          className="w-full py-1.5 text-[10px] tracking-widest uppercase font-bold border border-danger text-danger hover:bg-danger hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'ABORTING...' : 'ABORT MISSION'}
        </button>
      </div>
    </div>
  );
}

function PlanningTab({
  planningWaypoints,
  isLoading,
  missionError,
  onRemove,
  onClear,
  onSave,
}: {
  planningWaypoints: PlanningWaypoint[];
  isLoading: boolean;
  missionError: string | null;
  onRemove: (localId: number) => void;
  onClear: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [missionName, setMissionName] = useState(BLANK_INPUT_NAME);

  const handleSave = async () => {
    const trimmed = missionName.trim();
    if (!trimmed || planningWaypoints.length < 2) return;
    await onSave(trimmed);
    setMissionName(BLANK_INPUT_NAME);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-line">
        <div className="text-[10px] text-muted tracking-widest uppercase mb-1">NAME</div>
        <input
          type="text"
          value={missionName}
          onChange={(e) => setMissionName(e.target.value)}
          placeholder="PATROL-ALPHA"
          maxLength={100}
          className="w-full bg-elevated border border-line text-neon text-[11px] font-mono px-2 py-1 tracking-wider placeholder:text-muted focus:outline-none focus:border-neon"
        />
      </div>

      <div className="px-3 pt-2 pb-1 border-b border-line">
        <div className="flex justify-between text-[10px] tracking-widest">
          <span className="text-muted uppercase">Waypoints</span>
          <span className={planningWaypoints.length < 2 ? 'text-caution' : 'text-neon'}>
            {planningWaypoints.length}
          </span>
        </div>
        {planningWaypoints.length < 2 && (
          <div className="text-[9px] text-caution mt-0.5 tracking-widest">
            CLICK MAP TO ADD WAYPOINTS
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {planningWaypoints.map((wp, index) => (
          <div
            key={wp.localId}
            className="flex items-center px-3 py-1.5 border-b border-line text-[10px] group"
          >
            <span className="text-muted w-5 tabular-nums">{index + 1}</span>
            <span className="text-neon tabular-nums flex-1 text-[9px]">
              {formatFixed(wp.latitude, 4)}, {formatFixed(wp.longitude, 4)}
            </span>
            <span className="text-muted tabular-nums mr-2">{formatFixed(wp.altitude, 0)}m</span>
            <button
              onClick={() => onRemove(wp.localId)}
              className="text-danger opacity-0 group-hover:opacity-100 text-xs leading-none px-1"
              title="Remove waypoint"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {missionError && (
        <div className="px-3 py-1 text-[10px] text-danger tracking-widest border-t border-line">
          {missionError}
        </div>
      )}

      <div className="p-3 border-t border-line flex gap-2">
        <button
          onClick={() => void handleSave()}
          disabled={isLoading || missionName.trim().length === 0 || planningWaypoints.length < 2}
          className="flex-1 py-1.5 text-[10px] tracking-widest uppercase font-bold border border-neon text-neon hover:bg-neon hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'SAVING...' : 'SAVE'}
        </button>
        <button
          onClick={onClear}
          disabled={planningWaypoints.length === 0}
          className="px-3 py-1.5 text-[10px] tracking-widest uppercase font-bold border border-line text-muted hover:border-caution hover:text-caution disabled:opacity-40 disabled:cursor-not-allowed"
        >
          CLEAR
        </button>
      </div>
    </div>
  );
}

function SavedTab({
  missions,
  selectedDrone,
  activeMission,
  isLoading,
  missionError,
  onExecute,
  onDelete,
}: {
  missions: Mission[];
  selectedDrone: DroneId | null;
  activeMission: Mission | null;
  isLoading: boolean;
  missionError: string | null;
  onExecute: (missionId: number) => Promise<void>;
  onDelete: (missionId: number) => Promise<void>;
}) {
  const statusColor = (status: Mission['status']) =>
    status === 'ACTIVE'    ? 'text-caution' :
    status === 'COMPLETED' ? 'text-neon' :
    status === 'ABORTED'   ? 'text-danger' :
    'text-muted';

  const isMavlinkDrone = selectedDrone?.startsWith('MAVLINK-') ?? false;

  return (
    <div className="flex flex-col h-full">
      {missions.length === 0 && (
        <div className="px-3 py-4 text-[10px] text-muted tracking-widest text-center">
          NO SAVED MISSIONS
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {missions.map((mission) => (
          <div key={mission.id} className="border-b border-line px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold text-neon truncate max-w-[120px]">
                {mission.name}
              </span>
              <span className={`text-[9px] tracking-widest ${statusColor(mission.status)}`}>
                {mission.status}
              </span>
            </div>
            <div className="text-[9px] text-muted mt-0.5">
              {mission.waypoints.length} WP
              {mission.droneId ? ` · ${mission.droneId}` : ''}
            </div>
            <div className="flex gap-1.5 mt-2">
              {mission.status === 'PLANNED' && (
                <button
                  onClick={() => void onExecute(mission.id)}
                  disabled={isLoading || !selectedDrone || !isMavlinkDrone || activeMission !== null}
                  title={!isMavlinkDrone ? 'Requires a MAVLINK drone' : undefined}
                  className="flex-1 py-1 text-[9px] tracking-widest uppercase font-bold border border-neon text-neon hover:bg-neon hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  EXECUTE
                </button>
              )}
              {(mission.status === 'PLANNED' || mission.status === 'COMPLETED' || mission.status === 'ABORTED') && (
                <button
                  onClick={() => void onDelete(mission.id)}
                  disabled={isLoading}
                  className="px-2 py-1 text-[9px] tracking-widest uppercase font-bold border border-line text-muted hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  DEL
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {missionError && (
        <div className="px-3 py-1 text-[10px] text-danger tracking-widest border-t border-line">
          {missionError}
        </div>
      )}
    </div>
  );
}

export default function MissionPlanningPanel({
  selectedDrone,
  planningWaypoints,
  activeMission,
  missions,
  isLoading,
  missionError,
  onRemovePlanningWaypoint,
  onClearPlanningWaypoints,
  onSaveMission,
  onExecuteMission,
  onAbortMission,
  onDeleteMission,
}: MissionPlanningPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('plan');

  if (activeMission?.status === 'ACTIVE') {
    return (
      <div className="w-52 bg-panel border-l border-line flex flex-col min-h-0 overflow-hidden">
        <ActiveMissionView
          mission={activeMission}
          isLoading={isLoading}
          onAbort={() => void onAbortMission(activeMission.id)}
        />
      </div>
    );
  }

  return (
    <div className="w-52 bg-panel border-l border-line flex flex-col min-h-0 overflow-hidden">
      <div className="px-3 pt-2 pb-0 border-b border-line">
        <div className="text-[9px] text-muted tracking-widest uppercase mb-2">MISSION PLANNING</div>
        <div className="flex">
          {(['plan', 'saved'] as PanelTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 text-[9px] tracking-widest uppercase font-bold border-b-2 ${
                activeTab === tab
                  ? 'border-neon text-neon'
                  : 'border-transparent text-muted hover:text-neon'
              }`}
            >
              {tab === 'plan' ? 'NEW' : `SAVED (${missions.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === 'plan' ? (
          <PlanningTab
            planningWaypoints={planningWaypoints}
            isLoading={isLoading}
            missionError={missionError}
            onRemove={onRemovePlanningWaypoint}
            onClear={onClearPlanningWaypoints}
            onSave={onSaveMission}
          />
        ) : (
          <SavedTab
            missions={missions}
            selectedDrone={selectedDrone}
            activeMission={activeMission}
            isLoading={isLoading}
            missionError={missionError}
            onExecute={onExecuteMission}
            onDelete={onDeleteMission}
          />
        )}
      </div>
    </div>
  );
}
