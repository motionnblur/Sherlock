import { useState } from 'react';
import {
  MISSION_MIN_WAYPOINT_COUNT,
  MISSION_NUDGE_XY_METERS,
  MISSION_NUDGE_Z_METERS,
} from '../constants/mission';
import type { MissionPlanningPanelProps } from '../interfaces/components';
import type { Mission, MissionGizmoAxis, MissionWaypoint, PlanningWaypoint } from '../interfaces/mission';
import SectionHeader from './SectionHeader';
import { formatFixed } from '../utils/formatters';

const BLANK_INPUT_NAME = '';
type PanelTab = 'plan' | 'saved';

function WaypointStatusDot({ status }: { status: MissionWaypoint['status'] }) {
  const colorClass =
    status === 'REACHED' ? 'text-neon'
    : status === 'ACTIVE' ? 'text-caution'
    : status === 'SKIPPED' ? 'text-muted'
    : 'text-muted';
  const symbol =
    status === 'REACHED' ? '●'
    : status === 'ACTIVE' ? '◆'
    : '○';
  return <span className={`${colorClass} mr-1`}>{symbol}</span>;
}

function EditableWaypointList({
  waypoints,
  selectedWaypointLocalId,
  onSelect,
  onRemove,
}: {
  waypoints: PlanningWaypoint[];
  selectedWaypointLocalId: number | null;
  onSelect: (localId: number) => void;
  onRemove: (localId: number) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {waypoints.map((waypoint, index) => {
        const isSelected = selectedWaypointLocalId === waypoint.localId;
        return (
          <div
            key={waypoint.localId}
            className={`flex items-center px-3 py-1.5 border-b border-line text-[10px] group cursor-pointer ${
              isSelected ? 'bg-elevated' : 'hover:bg-elevated'
            }`}
            onClick={() => onSelect(waypoint.localId)}
          >
            <span className={`w-5 tabular-nums ${isSelected ? 'text-neon' : 'text-muted'}`}>
              {index + 1}
            </span>
            <span className="text-neon tabular-nums flex-1 text-[9px]">
              {formatFixed(waypoint.latitude, 4)}, {formatFixed(waypoint.longitude, 4)}
            </span>
            <span className="text-muted tabular-nums mr-2">{formatFixed(waypoint.altitude, 0)}m</span>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onRemove(waypoint.localId);
              }}
              disabled={waypoints.length <= MISSION_MIN_WAYPOINT_COUNT}
              className="text-danger opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none px-1"
              title="Remove waypoint"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

function NudgeControls({
  selectedWaypoint,
  onNudge,
}: {
  selectedWaypoint: PlanningWaypoint | null;
  onNudge: (axis: MissionGizmoAxis, distanceMeters: number) => void;
}) {
  if (!selectedWaypoint) {
    return (
      <div className="px-3 py-2 border-t border-line text-[9px] tracking-widest text-muted">
        SELECT A WAYPOINT TO USE X/Y/Z NUDGE
      </div>
    );
  }

  const rows: Array<{ axis: MissionGizmoAxis; label: string; stepMeters: number }> = [
    { axis: 'X', label: 'X', stepMeters: MISSION_NUDGE_XY_METERS },
    { axis: 'Y', label: 'Y', stepMeters: MISSION_NUDGE_XY_METERS },
    { axis: 'Z', label: 'Z', stepMeters: MISSION_NUDGE_Z_METERS },
  ];

  return (
    <div className="px-3 py-2 border-t border-line">
      <div className="text-[9px] tracking-widest text-muted uppercase mb-1">Node Adjust</div>
      {rows.map((row) => (
        <div key={row.axis} className="flex items-center justify-between mb-1 last:mb-0">
          <span className="text-[9px] tracking-widest text-muted">{row.label}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNudge(row.axis, -row.stepMeters)}
              className="px-2 py-0.5 text-[9px] tracking-widest border border-line text-neon hover:border-neon"
            >
              -
            </button>
            <span className="text-[9px] text-muted tabular-nums w-10 text-center">{row.stepMeters}m</span>
            <button
              onClick={() => onNudge(row.axis, row.stepMeters)}
              className="px-2 py-0.5 text-[9px] tracking-widest border border-line text-neon hover:border-neon"
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
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
  const reached = mission.waypoints.filter((waypoint) => waypoint.status === 'REACHED').length;
  const total = mission.waypoints.length;

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
        {mission.waypoints.map((waypoint) => (
          <div
            key={waypoint.id}
            className="flex items-center px-3 py-1.5 border-b border-line text-[10px]"
          >
            <WaypointStatusDot status={waypoint.status} />
            <span className="text-muted w-5 tabular-nums">{waypoint.sequence + 1}</span>
            <span className="text-neon tabular-nums flex-1">
              {formatFixed(waypoint.latitude, 4)}, {formatFixed(waypoint.longitude, 4)}
            </span>
            <span className="text-muted tabular-nums">{formatFixed(waypoint.altitude, 0)}m</span>
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
  selectedMissionWaypointLocalId,
  isLoading,
  missionError,
  onSelectWaypoint,
  onRemoveWaypoint,
  onClear,
  onNudge,
  onSave,
}: {
  planningWaypoints: PlanningWaypoint[];
  selectedMissionWaypointLocalId: number | null;
  isLoading: boolean;
  missionError: string | null;
  onSelectWaypoint: (localId: number | null) => void;
  onRemoveWaypoint: (localId: number) => void;
  onClear: () => void;
  onNudge: (axis: MissionGizmoAxis, distanceMeters: number) => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [missionName, setMissionName] = useState(BLANK_INPUT_NAME);
  const selectedWaypoint = planningWaypoints.find((waypoint) => waypoint.localId === selectedMissionWaypointLocalId) ?? null;

  const handleSave = async () => {
    const trimmed = missionName.trim();
    if (!trimmed || planningWaypoints.length < MISSION_MIN_WAYPOINT_COUNT) return;
    await onSave(trimmed);
    setMissionName(BLANK_INPUT_NAME);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-line">
        <div className="text-[10px] text-muted tracking-widest uppercase mb-1">Name</div>
        <input
          type="text"
          value={missionName}
          onChange={(event) => setMissionName(event.target.value)}
          placeholder="PATROL-ALPHA"
          maxLength={100}
          className="w-full bg-elevated border border-line text-neon text-[11px] font-mono px-2 py-1 tracking-wider placeholder:text-muted focus:outline-none focus:border-neon"
        />
      </div>

      <div className="px-3 pt-2 pb-1 border-b border-line">
        <div className="flex justify-between text-[10px] tracking-widest">
          <span className="text-muted uppercase">Waypoints</span>
          <span className={planningWaypoints.length < MISSION_MIN_WAYPOINT_COUNT ? 'text-caution' : 'text-neon'}>
            {planningWaypoints.length}
          </span>
        </div>
        {planningWaypoints.length < MISSION_MIN_WAYPOINT_COUNT && (
          <div className="text-[9px] text-caution mt-0.5 tracking-widest">
            CLICK MAP TO ADD WAYPOINTS
          </div>
        )}
      </div>

      <EditableWaypointList
        waypoints={planningWaypoints}
        selectedWaypointLocalId={selectedMissionWaypointLocalId}
        onSelect={(localId) => onSelectWaypoint(localId)}
        onRemove={onRemoveWaypoint}
      />

      <NudgeControls selectedWaypoint={selectedWaypoint} onNudge={onNudge} />

      {missionError && (
        <div className="px-3 py-1 text-[10px] text-danger tracking-widest border-t border-line">
          {missionError}
        </div>
      )}

      <div className="p-3 border-t border-line flex gap-2">
        <button
          onClick={() => void handleSave()}
          disabled={isLoading || missionName.trim().length === 0 || planningWaypoints.length < MISSION_MIN_WAYPOINT_COUNT}
          className="flex-1 py-1.5 text-[10px] tracking-widest uppercase font-bold border border-neon text-neon hover:bg-neon hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'SAVING...' : 'SAVE'}
        </button>
        <button
          onClick={() => {
            onClear();
            onSelectWaypoint(null);
          }}
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
  onStartEdit,
  onExecute,
  onDelete,
}: {
  missions: Mission[];
  selectedDrone: string | null;
  activeMission: Mission | null;
  isLoading: boolean;
  missionError: string | null;
  onStartEdit: (missionId: number) => void;
  onExecute: (missionId: number) => Promise<void>;
  onDelete: (missionId: number) => Promise<void>;
}) {
  const statusColor = (status: Mission['status']) =>
    status === 'ACTIVE' ? 'text-caution'
    : status === 'COMPLETED' ? 'text-neon'
    : status === 'ABORTED' ? 'text-danger'
    : 'text-muted';

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
                <>
                  <button
                    onClick={() => onStartEdit(mission.id)}
                    disabled={isLoading}
                    className="px-2 py-1 text-[9px] tracking-widest uppercase font-bold border border-line text-neon hover:border-neon disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => void onExecute(mission.id)}
                    disabled={isLoading || !selectedDrone || !isMavlinkDrone || activeMission !== null}
                    title={!isMavlinkDrone ? 'Requires a MAVLINK drone' : undefined}
                    className="flex-1 py-1 text-[9px] tracking-widest uppercase font-bold border border-neon text-neon hover:bg-neon hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    EXECUTE
                  </button>
                </>
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

function SavedEditView({
  missionName,
  waypoints,
  selectedMissionWaypointLocalId,
  isLoading,
  missionError,
  onUpdateName,
  onSelectWaypoint,
  onRemoveWaypoint,
  onNudge,
  onCancel,
  onSave,
}: {
  missionName: string;
  waypoints: PlanningWaypoint[];
  selectedMissionWaypointLocalId: number | null;
  isLoading: boolean;
  missionError: string | null;
  onUpdateName: (name: string) => void;
  onSelectWaypoint: (localId: number | null) => void;
  onRemoveWaypoint: (localId: number) => void;
  onNudge: (axis: MissionGizmoAxis, distanceMeters: number) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const selectedWaypoint = waypoints.find((waypoint) => waypoint.localId === selectedMissionWaypointLocalId) ?? null;
  const canSave = missionName.trim().length > 0 && waypoints.length >= MISSION_MIN_WAYPOINT_COUNT;

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title="EDIT PLANNED" />

      <div className="px-3 py-2 border-b border-line">
        <div className="text-[10px] text-muted tracking-widest uppercase mb-1">Name</div>
        <input
          type="text"
          value={missionName}
          onChange={(event) => onUpdateName(event.target.value)}
          placeholder="PATROL-ALPHA"
          maxLength={100}
          className="w-full bg-elevated border border-line text-neon text-[11px] font-mono px-2 py-1 tracking-wider placeholder:text-muted focus:outline-none focus:border-neon"
        />
      </div>

      <div className="px-3 pt-2 pb-1 border-b border-line">
        <div className="flex justify-between text-[10px] tracking-widest">
          <span className="text-muted uppercase">Waypoints</span>
          <span className={waypoints.length < MISSION_MIN_WAYPOINT_COUNT ? 'text-caution' : 'text-neon'}>
            {waypoints.length}
          </span>
        </div>
        {waypoints.length < MISSION_MIN_WAYPOINT_COUNT && (
          <div className="text-[9px] text-caution mt-0.5 tracking-widest">
            MINIMUM 2 WAYPOINTS REQUIRED
          </div>
        )}
      </div>

      <EditableWaypointList
        waypoints={waypoints}
        selectedWaypointLocalId={selectedMissionWaypointLocalId}
        onSelect={(localId) => onSelectWaypoint(localId)}
        onRemove={onRemoveWaypoint}
      />

      <NudgeControls selectedWaypoint={selectedWaypoint} onNudge={onNudge} />

      {missionError && (
        <div className="px-3 py-1 text-[10px] text-danger tracking-widest border-t border-line">
          {missionError}
        </div>
      )}

      <div className="p-3 border-t border-line flex gap-2">
        <button
          onClick={() => void onSave()}
          disabled={isLoading || !canSave}
          className="flex-1 py-1.5 text-[10px] tracking-widest uppercase font-bold border border-neon text-neon hover:bg-neon hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-[10px] tracking-widest uppercase font-bold border border-line text-muted hover:border-caution hover:text-caution"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

export default function MissionPlanningPanel({
  selectedDrone,
  selectedMissionWaypointLocalId,
  planningWaypoints,
  editingMissionId,
  editingMissionName,
  editingWaypoints,
  activeMission,
  missions,
  isLoading,
  missionError,
  onSelectMissionWaypoint,
  onRemovePlanningWaypoint,
  onClearPlanningWaypoints,
  onSaveMission,
  onStartEditMission,
  onCancelEditMission,
  onUpdateEditingMissionName,
  onSaveEditedMission,
  onRemoveEditingWaypoint,
  onNudgeMissionWaypoint,
  onExecuteMission,
  onAbortMission,
  onDeleteMission,
}: MissionPlanningPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('plan');
  const isEditingSavedMission = editingMissionId !== null;

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
      {!isEditingSavedMission && (
        <div className="px-3 pt-2 pb-0 border-b border-line">
          <div className="text-[9px] text-muted tracking-widest uppercase mb-2">MISSION PLANNING</div>
          <div className="flex">
            {(['plan', 'saved'] as PanelTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  onSelectMissionWaypoint(null);
                }}
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
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {isEditingSavedMission ? (
          <SavedEditView
            missionName={editingMissionName}
            waypoints={editingWaypoints}
            selectedMissionWaypointLocalId={selectedMissionWaypointLocalId}
            isLoading={isLoading}
            missionError={missionError}
            onUpdateName={onUpdateEditingMissionName}
            onSelectWaypoint={onSelectMissionWaypoint}
            onRemoveWaypoint={onRemoveEditingWaypoint}
            onNudge={onNudgeMissionWaypoint}
            onCancel={onCancelEditMission}
            onSave={onSaveEditedMission}
          />
        ) : activeTab === 'plan' ? (
          <PlanningTab
            planningWaypoints={planningWaypoints}
            selectedMissionWaypointLocalId={selectedMissionWaypointLocalId}
            isLoading={isLoading}
            missionError={missionError}
            onSelectWaypoint={onSelectMissionWaypoint}
            onRemoveWaypoint={onRemovePlanningWaypoint}
            onClear={onClearPlanningWaypoints}
            onNudge={onNudgeMissionWaypoint}
            onSave={onSaveMission}
          />
        ) : (
          <SavedTab
            missions={missions}
            selectedDrone={selectedDrone}
            activeMission={activeMission}
            isLoading={isLoading}
            missionError={missionError}
            onStartEdit={onStartEditMission}
            onExecute={onExecuteMission}
            onDelete={onDeleteMission}
          />
        )}
      </div>
    </div>
  );
}
