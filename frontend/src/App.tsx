import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTelemetry } from './hooks/useTelemetry';
import { useStreamUrl } from './hooks/useStreamUrl';
import { useLastKnownTelemetry } from './hooks/useLastKnownTelemetry';
import { useGeofences } from './hooks/useGeofences';
import { useCommand } from './hooks/useCommand';
import { useDroneRegistry } from './hooks/useDroneRegistry';
import { useMission } from './hooks/useMission';
import {
  DRIVER_DEFAULT_ALTITUDE_METERS,
  DRIVER_REACHED_HORIZONTAL_METERS,
  DRIVER_REACHED_VERTICAL_METERS,
} from './constants/driver';
import {
  MISSION_DEFAULT_ALTITUDE_METERS,
  MISSION_MIN_ALTITUDE_METERS,
  MISSION_MIN_WAYPOINT_COUNT,
} from './constants/mission';
import {
  GEOFENCE_MAX_POINT_COUNT,
  GEOFENCE_MIN_POINT_COUNT,
} from './constants/telemetry';
import { NAVIGATION_DIRECTION_ALL } from './constants/navigation';
import {
  getNextPerformanceStage,
  PERFORMANCE_STAGE_NORMAL,
} from './constants/performance';
import Header from './components/Header';
import TelemetryPanel from './components/TelemetryPanel';
import MapComponent from './components/MapComponent';
import SystemPanel from './components/SystemPanel';
import MissionPlanningPanel from './components/MissionPlanningPanel';
import StatusBar from './components/StatusBar';
import LiveVideoWindow from './components/LiveVideoWindow';
import LoginPage from './components/LoginPage';
import AssetSelectionOverlay from './components/AssetSelectionOverlay';
import LowBatteryWindow from './components/LowBatteryWindow';
import GeofenceAlertWindow from './components/GeofenceAlertWindow';
import type { DriverWaypoint, DroneId, NavigationDirection } from './interfaces/telemetry';
import type { GeofencePointInput } from './interfaces/geofence';
import type { MissionGizmoAxis, MissionWaypoint, PlanningWaypoint } from './interfaces/mission';
import { horizontalDistanceMeters } from './utils/geo';
import { matchesNavigationDirection } from './utils/navigation';

const AUTH_LOGOUT_PATH = '/api/auth/logout';
const EARTH_RADIUS_METERS = 6378137;
const METERS_TO_DEGREES = 180 / Math.PI;

interface SavedMissionDraft {
  missionId: number;
  missionName: string;
  waypoints: PlanningWaypoint[];
}

export default function App() {
  const { authToken, logout } = useAuth();

  const [selectedDrone, setSelectedDrone] = useState<DroneId | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const [performanceStage, setPerformanceStage] = useState(PERFORMANCE_STAGE_NORMAL);
  const [isLiveVideoOpen, setIsLiveVideoOpen] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [selectedNavigationDirection, setSelectedNavigationDirection] =
    useState<NavigationDirection>(NAVIGATION_DIRECTION_ALL);
  const [isDriverModeEnabled, setIsDriverModeEnabled] = useState(false);
  const [driverWaypoints, setDriverWaypoints] = useState<DriverWaypoint[]>([]);
  const driverWaypointIdRef = useRef(1);
  const driverDispatchInFlightRef = useRef(false);

  const [isMissionModeEnabled, setIsMissionModeEnabled] = useState(false);
  const [planningWaypoints, setPlanningWaypoints] = useState<PlanningWaypoint[]>([]);
  const [editingMissionDraft, setEditingMissionDraft] = useState<SavedMissionDraft | null>(null);
  const [selectedMissionWaypointLocalId, setSelectedMissionWaypointLocalId] = useState<number | null>(null);
  const planningWaypointIdRef = useRef(1);
  const [isGeofenceModeEnabled, setIsGeofenceModeEnabled] = useState(false);
  const [geofenceDraftName, setGeofenceDraftName] = useState('');
  const [geofenceDraftPoints, setGeofenceDraftPoints] = useState<GeofencePointInput[]>([]);

  const { droneIds } = useDroneRegistry(authToken);
  const {
    missions,
    activeMission,
    isLoading: isMissionLoading,
    missionError,
    createMission,
    updateMission,
    executeMission,
    abortMission,
    deleteMission,
  } = useMission(authToken);
  const {
    geofences,
    isLoading: isGeofenceSaving,
    geofenceError,
    createGeofence,
  } = useGeofences(authToken);
  const { telemetry, fleetTelemetry, connected, history, batteryAlerts, geofenceAlerts } = useTelemetry(selectedDrone, freeMode, showAllAssets);
  const lastKnownTelemetry = useLastKnownTelemetry(droneIds, selectedDrone !== null);
  const { streamUrl, isFetching, fetchError, fetchStreamUrl, clearStreamUrl } = useStreamUrl();
  const { sendCommand, isSending: isCommandSending, commandError } = useCommand(selectedDrone, authToken);
  const isDriverModeAvailable = Boolean(selectedDrone?.startsWith('MAVLINK-')) && !freeMode;
  const isMissionModeAvailable = Boolean(selectedDrone) && !freeMode;
  const isGeofenceModeAvailable = Boolean(selectedDrone) && !freeMode;

  const resetNavigationDirection = useCallback(() => {
    setSelectedNavigationDirection(NAVIGATION_DIRECTION_ALL);
  }, []);

  const clearDriverRoute = useCallback(() => {
    setDriverWaypoints([]);
    driverDispatchInFlightRef.current = false;
  }, []);

  const clearMissionPlanning = useCallback(() => {
    setPlanningWaypoints([]);
    planningWaypointIdRef.current = 1;
    setSelectedMissionWaypointLocalId(null);
  }, []);

  const clearSavedMissionEdit = useCallback(() => {
    setEditingMissionDraft(null);
    setSelectedMissionWaypointLocalId(null);
  }, []);

  const clearGeofenceDraft = useCallback(() => {
    setGeofenceDraftName('');
    setGeofenceDraftPoints([]);
  }, []);

  const handleToggleMissionMode = useCallback(() => {
    if (!isMissionModeAvailable) return;
    setIsMissionModeEnabled((current) => {
      const next = !current;
      if (!next) {
        clearMissionPlanning();
        clearSavedMissionEdit();
      }
      // mission mode and driver mode are mutually exclusive
      if (next) setIsDriverModeEnabled(false);
      if (next) {
        setIsGeofenceModeEnabled(false);
        clearGeofenceDraft();
      }
      return next;
    });
  }, [clearGeofenceDraft, clearMissionPlanning, clearSavedMissionEdit, isMissionModeAvailable]);

  const handleToggleGeofenceMode = useCallback(() => {
    if (!isGeofenceModeAvailable) {
      return;
    }
    setIsGeofenceModeEnabled((current) => {
      const next = !current;
      if (next) {
        setIsDriverModeEnabled(false);
        clearDriverRoute();
        setIsMissionModeEnabled(false);
        clearMissionPlanning();
        clearSavedMissionEdit();
      }
      return next;
    });
  }, [clearDriverRoute, clearGeofenceDraft, clearMissionPlanning, clearSavedMissionEdit, isGeofenceModeAvailable]);

  const handleAddMissionWaypoint = useCallback((latitude: number, longitude: number) => {
    if (!isMissionModeEnabled || !selectedDrone || freeMode) return;
    if (activeMission?.status === 'ACTIVE') return;

    const altitude = telemetry?.altitude ?? MISSION_DEFAULT_ALTITUDE_METERS;
    const localId = planningWaypointIdRef.current++;
    const nextWaypoint: PlanningWaypoint = {
      localId,
      latitude,
      longitude,
      altitude,
    };

    if (editingMissionDraft) {
      setEditingMissionDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          waypoints: [...current.waypoints, nextWaypoint],
        };
      });
    } else {
      setPlanningWaypoints((current) => [...current, nextWaypoint]);
    }
    setSelectedMissionWaypointLocalId(localId);
  }, [
    isMissionModeEnabled,
    selectedDrone,
    freeMode,
    telemetry?.altitude,
    activeMission?.status,
    editingMissionDraft,
  ]);

  const handleAddGeofenceVertex = useCallback((latitude: number, longitude: number) => {
    if (!isGeofenceModeEnabled || !selectedDrone || freeMode) {
      return;
    }

    setGeofenceDraftPoints((currentPoints) => {
      if (currentPoints.length >= GEOFENCE_MAX_POINT_COUNT) {
        return currentPoints;
      }

      return [
        ...currentPoints,
        {
          sequence: currentPoints.length,
          latitude,
          longitude,
        },
      ];
    });
  }, [freeMode, isGeofenceModeEnabled, selectedDrone]);

  const handleUpdateGeofenceDraftName = useCallback((name: string) => {
    setGeofenceDraftName(name);
  }, []);

  const handleCancelGeofenceDrawing = useCallback(() => {
    clearGeofenceDraft();
  }, [clearGeofenceDraft]);

  const handleCompleteGeofenceDrawing = useCallback(async () => {
    if (!isGeofenceModeEnabled || !selectedDrone || freeMode) {
      return;
    }

    const trimmedName = geofenceDraftName.trim();
    if (trimmedName.length === 0 || geofenceDraftPoints.length < GEOFENCE_MIN_POINT_COUNT) {
      return;
    }

    const created = await createGeofence({
      name: trimmedName,
      isActive: true,
      points: geofenceDraftPoints,
    });

    if (created) {
      clearGeofenceDraft();
    }
  }, [
    clearGeofenceDraft,
    createGeofence,
    freeMode,
    geofenceDraftName,
    geofenceDraftPoints,
    isGeofenceModeEnabled,
    selectedDrone,
  ]);

  const handleRemovePlanningWaypoint = useCallback((localId: number) => {
    setPlanningWaypoints((current) => current.filter((waypoint) => waypoint.localId !== localId));
    setSelectedMissionWaypointLocalId((current) => (current === localId ? null : current));
  }, []);

  const handleRemoveEditingWaypoint = useCallback((localId: number) => {
    setEditingMissionDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        waypoints: current.waypoints.filter((waypoint) => waypoint.localId !== localId),
      };
    });
    setSelectedMissionWaypointLocalId((current) => (current === localId ? null : current));
  }, []);

  const handleSaveMission = useCallback(async (name: string) => {
    if (planningWaypoints.length < MISSION_MIN_WAYPOINT_COUNT) return;
    await createMission(name, planningWaypoints);
    clearMissionPlanning();
  }, [planningWaypoints, createMission, clearMissionPlanning]);

  const handleStartEditMission = useCallback((missionId: number) => {
    const missionToEdit = missions.find((mission) => mission.id === missionId);
    if (!missionToEdit || missionToEdit.status !== 'PLANNED') {
      return;
    }

    const editableWaypoints = missionToEdit.waypoints.map((waypoint) => ({
      localId: planningWaypointIdRef.current++,
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      altitude: waypoint.altitude,
      label: waypoint.label,
    }));

    setEditingMissionDraft({
      missionId: missionToEdit.id,
      missionName: missionToEdit.name,
      waypoints: editableWaypoints,
    });
    setSelectedMissionWaypointLocalId(editableWaypoints[0]?.localId ?? null);
  }, [missions]);

  const handleCancelMissionEdit = useCallback(() => {
    clearSavedMissionEdit();
  }, [clearSavedMissionEdit]);

  const handleUpdateEditingMissionName = useCallback((name: string) => {
    setEditingMissionDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        missionName: name,
      };
    });
  }, []);

  const handleSaveEditedMission = useCallback(async () => {
    if (!editingMissionDraft) {
      return;
    }
    const trimmedName = editingMissionDraft.missionName.trim();
    if (!trimmedName || editingMissionDraft.waypoints.length < MISSION_MIN_WAYPOINT_COUNT) {
      return;
    }

    const updated = await updateMission(
      editingMissionDraft.missionId,
      trimmedName,
      editingMissionDraft.waypoints,
    );
    if (updated) {
      clearSavedMissionEdit();
    }
  }, [clearSavedMissionEdit, editingMissionDraft, updateMission]);

  const handleExecuteMission = useCallback(async (missionId: number) => {
    if (!selectedDrone) return;
    await executeMission(missionId, selectedDrone);
  }, [selectedDrone, executeMission]);

  const handleAbortMission = useCallback(async (missionId: number) => {
    await abortMission(missionId);
  }, [abortMission]);

  const handleDeleteMission = useCallback(async (missionId: number) => {
    await deleteMission(missionId);
  }, [deleteMission]);

  const handleSelectMissionWaypoint = useCallback((localId: number | null) => {
    setSelectedMissionWaypointLocalId(localId);
  }, []);

  const handleMoveMissionWaypoint = useCallback((localId: number, position: {
    latitude: number;
    longitude: number;
    altitude: number;
  }) => {
    if (editingMissionDraft) {
      setEditingMissionDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          waypoints: current.waypoints.map((waypoint) =>
            waypoint.localId === localId ? { ...waypoint, ...position } : waypoint,
          ),
        };
      });
      return;
    }

    setPlanningWaypoints((current) =>
      current.map((waypoint) =>
        waypoint.localId === localId ? { ...waypoint, ...position } : waypoint,
      ),
    );
  }, [editingMissionDraft]);

  const handleNudgeMissionWaypoint = useCallback((axis: MissionGizmoAxis, distanceMeters: number) => {
    if (selectedMissionWaypointLocalId === null) {
      return;
    }

    const nudgeWaypoint = (waypoint: PlanningWaypoint): PlanningWaypoint => {
      if (waypoint.localId !== selectedMissionWaypointLocalId) {
        return waypoint;
      }

      if (axis === 'Z') {
        return {
          ...waypoint,
          altitude: Math.max(MISSION_MIN_ALTITUDE_METERS, waypoint.altitude + distanceMeters),
        };
      }

      if (axis === 'Y') {
        const deltaLatitude = (distanceMeters / EARTH_RADIUS_METERS) * METERS_TO_DEGREES;
        return { ...waypoint, latitude: waypoint.latitude + deltaLatitude };
      }

      const latitudeRadians = (waypoint.latitude * Math.PI) / 180;
      const horizontalRadius = EARTH_RADIUS_METERS * Math.cos(latitudeRadians);
      if (Math.abs(horizontalRadius) < 1e-6) {
        return waypoint;
      }
      const deltaLongitude = (distanceMeters / horizontalRadius) * METERS_TO_DEGREES;
      return { ...waypoint, longitude: waypoint.longitude + deltaLongitude };
    };

    if (editingMissionDraft) {
      setEditingMissionDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          waypoints: current.waypoints.map(nudgeWaypoint),
        };
      });
      return;
    }

    setPlanningWaypoints((current) => current.map(nudgeWaypoint));
  }, [editingMissionDraft, selectedMissionWaypointLocalId]);

  const handleToggleLiveVideo = useCallback(() => {
    if (!selectedDrone || freeMode) return;

    if (isLiveVideoOpen) {
      setIsLiveVideoOpen(false);
      clearStreamUrl();
    } else {
      setIsLiveVideoOpen(true);
      fetchStreamUrl(selectedDrone);
    }
  }, [isLiveVideoOpen, selectedDrone, freeMode, fetchStreamUrl, clearStreamUrl]);

  const handleCloseLiveVideo = useCallback(() => {
    setIsLiveVideoOpen(false);
    clearStreamUrl();
  }, [clearStreamUrl]);

  const handleToggleFreeMode = useCallback(() => {
    // Close live video whenever Free Mode turns on — no HLS connection in the background.
    setFreeMode((current) => {
      const nextFreeMode = !current;
      if (nextFreeMode) {
        setIsLiveVideoOpen(false);
        clearStreamUrl();
        setIsDriverModeEnabled(false);
        clearDriverRoute();
        setIsMissionModeEnabled(false);
        clearMissionPlanning();
        clearSavedMissionEdit();
        setIsGeofenceModeEnabled(false);
        clearGeofenceDraft();
      } else {
        setShowAllAssets(false);
        resetNavigationDirection();
      }
      return nextFreeMode;
    });
  }, [clearDriverRoute, clearGeofenceDraft, clearMissionPlanning, clearSavedMissionEdit, clearStreamUrl, resetNavigationDirection]);

  const handleToggleShowAllAssets = useCallback(() => {
    setShowAllAssets((current) => {
      const nextShowAllAssets = !current;
      if (!nextShowAllAssets) {
        resetNavigationDirection();
      }
      return nextShowAllAssets;
    });
  }, [resetNavigationDirection]);

  const handleActivateDrone = useCallback((id: DroneId) => {
    setSelectedDrone(id);
    setFreeMode(false);
    setIsDriverModeEnabled(false);
    clearDriverRoute();
    setIsMissionModeEnabled(false);
    clearMissionPlanning();
    clearSavedMissionEdit();
    setIsGeofenceModeEnabled(false);
    clearGeofenceDraft();
    resetNavigationDirection();
  }, [clearDriverRoute, clearGeofenceDraft, clearMissionPlanning, clearSavedMissionEdit, resetNavigationDirection]);

  const handleDeselect = useCallback(() => {
    setSelectedDrone(null);
    setFreeMode(false);
    setIsDriverModeEnabled(false);
    setIsMissionModeEnabled(false);
    setIsGeofenceModeEnabled(false);
    setIsLiveVideoOpen(false);
    clearStreamUrl();
    setShowAllAssets(false);
    clearDriverRoute();
    clearMissionPlanning();
    clearSavedMissionEdit();
    clearGeofenceDraft();
    resetNavigationDirection();
  }, [clearDriverRoute, clearGeofenceDraft, clearMissionPlanning, clearSavedMissionEdit, clearStreamUrl, resetNavigationDirection]);

  const handleToggleDriverMode = useCallback(() => {
    if (!isDriverModeAvailable) {
      return;
    }
    setIsDriverModeEnabled((currentMode) => {
      const nextMode = !currentMode;
      if (!nextMode) {
        clearDriverRoute();
      } else {
        setIsGeofenceModeEnabled(false);
        clearGeofenceDraft();
      }
      return nextMode;
    });
  }, [clearDriverRoute, clearGeofenceDraft, isDriverModeAvailable]);

  const resolveDriverWaypointAltitude = useCallback(() => {
    if (selectedDrone && telemetry?.droneId === selectedDrone) {
      return telemetry.altitude;
    }
    if (selectedDrone && fleetTelemetry[selectedDrone]) {
      return fleetTelemetry[selectedDrone].altitude;
    }
    if (selectedDrone && lastKnownTelemetry[selectedDrone]) {
      return lastKnownTelemetry[selectedDrone].altitude;
    }
    return DRIVER_DEFAULT_ALTITUDE_METERS;
  }, [fleetTelemetry, lastKnownTelemetry, selectedDrone, telemetry]);

  const handleAddDriverWaypoint = useCallback((latitude: number, longitude: number) => {
    if (!isDriverModeEnabled || !selectedDrone || freeMode) {
      return;
    }
    const baseAltitude = resolveDriverWaypointAltitude();

    const waypoint: DriverWaypoint = {
      id: driverWaypointIdRef.current,
      latitude,
      longitude,
      altitude: baseAltitude,
      status: 'queued',
    };
    driverWaypointIdRef.current += 1;
    setDriverWaypoints((currentRoute) => [...currentRoute, waypoint]);
  }, [freeMode, isDriverModeEnabled, resolveDriverWaypointAltitude, selectedDrone]);

  const filteredBatteryAlerts = useMemo(() => {
    if (!freeMode || !showAllAssets) {
      return [];
    }
    if (selectedNavigationDirection === NAVIGATION_DIRECTION_ALL) {
      return batteryAlerts;
    }
    return batteryAlerts.filter((alert) => {
      const directionSource = fleetTelemetry[alert.droneId] ?? lastKnownTelemetry[alert.droneId];
      if (!directionSource) {
        return false;
      }
      return matchesNavigationDirection(directionSource.heading, selectedNavigationDirection);
    });
  }, [
    batteryAlerts,
    fleetTelemetry,
    freeMode,
    lastKnownTelemetry,
    selectedNavigationDirection,
    showAllAssets,
  ]);

  const editableMissionWaypoints = editingMissionDraft?.waypoints ?? planningWaypoints;
  const isMissionWaypointEditingEnabled = isMissionModeEnabled
    && !freeMode
    && selectedDrone !== null
    && activeMission?.status !== 'ACTIVE';

  // Compose the waypoints shown on the map: active mission progress takes priority over editable draft state.
  const mapMissionWaypoints = useMemo((): MissionWaypoint[] => {
    if (activeMission?.status === 'ACTIVE') {
      return activeMission.waypoints;
    }
    return editableMissionWaypoints.map((wp, index) => ({
      localId: wp.localId,
      id: null,
      sequence: index,
      latitude: wp.latitude,
      longitude: wp.longitude,
      altitude: wp.altitude,
      status: 'PENDING' as const,
    }));
  }, [activeMission, editableMissionWaypoints]);

  const handleLogout = useCallback(async () => {
    if (authToken) {
      // Best-effort server-side token revocation — do not block UI on failure.
      fetch(AUTH_LOGOUT_PATH, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken.token}` },
      }).catch(() => {});
    }
    logout();
  }, [authToken, logout]);

  useEffect(() => {
    if (!isDriverModeEnabled || !isDriverModeAvailable || driverDispatchInFlightRef.current) {
      return;
    }
    if (telemetry?.isArmed !== true) {
      return;
    }
    if (driverWaypoints.some((waypoint) => waypoint.status === 'active')) {
      return;
    }
    const queuedWaypoint = driverWaypoints.find((waypoint) => waypoint.status === 'queued');
    if (!queuedWaypoint) {
      return;
    }

    const dispatchGoto = async () => {
      driverDispatchInFlightRef.current = true;
      try {
        const wasSent = await sendCommand('GOTO', {
          latitude: queuedWaypoint.latitude,
          longitude: queuedWaypoint.longitude,
          altitude: queuedWaypoint.altitude,
        });
        setDriverWaypoints((currentRoute) =>
          currentRoute.map((waypoint) => {
            if (waypoint.id !== queuedWaypoint.id) {
              return waypoint;
            }
            return { ...waypoint, status: wasSent ? 'active' : 'failed' };
          }),
        );
      } finally {
        driverDispatchInFlightRef.current = false;
      }
    };

    void dispatchGoto();
  }, [
    driverWaypoints,
    isDriverModeAvailable,
    isDriverModeEnabled,
    sendCommand,
    telemetry?.isArmed,
  ]);

  useEffect(() => {
    if (!isDriverModeEnabled || !isDriverModeAvailable || !telemetry) {
      return;
    }
    const activeWaypoint = driverWaypoints.find((waypoint) => waypoint.status === 'active');
    if (!activeWaypoint) {
      return;
    }
    const horizontalDistance = horizontalDistanceMeters(
      telemetry.latitude,
      telemetry.longitude,
      activeWaypoint.latitude,
      activeWaypoint.longitude,
    );
    const verticalDistance = Math.abs(telemetry.altitude - activeWaypoint.altitude);

    if (horizontalDistance > DRIVER_REACHED_HORIZONTAL_METERS || verticalDistance > DRIVER_REACHED_VERTICAL_METERS) {
      return;
    }
    setDriverWaypoints((currentRoute) =>
      currentRoute.map((waypoint) =>
        waypoint.id === activeWaypoint.id ? { ...waypoint, status: 'reached' } : waypoint,
      ),
    );
  }, [driverWaypoints, isDriverModeAvailable, isDriverModeEnabled, telemetry]);

  if (!authToken) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen flex flex-col bg-surface font-mono text-neon overflow-hidden select-none">
      <Header
        connected={connected}
        selectedDrone={selectedDrone}
        freeMode={freeMode}
        isLiveVideoOpen={isLiveVideoOpen}
        showAllAssets={showAllAssets}
        selectedNavigationDirection={selectedNavigationDirection}
        isMissionModeEnabled={isMissionModeEnabled}
        isGeofenceModeEnabled={isGeofenceModeEnabled}
        onToggleFreeMode={handleToggleFreeMode}
        onDeselect={handleDeselect}
        onToggleLiveVideo={handleToggleLiveVideo}
        onToggleShowAllAssets={handleToggleShowAllAssets}
        onSelectNavigationDirection={setSelectedNavigationDirection}
        onToggleMissionMode={handleToggleMissionMode}
        onToggleGeofenceMode={handleToggleGeofenceMode}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 min-h-0 border-t border-line">
        {selectedDrone && !freeMode && <TelemetryPanel telemetry={telemetry} />}

        <main className="flex-1 relative min-w-0">
          {selectedDrone ? (
            <>
              <MapComponent
                droneIds={droneIds}
                telemetry={telemetry}
                fleetTelemetry={fleetTelemetry}
                lastKnownTelemetry={lastKnownTelemetry}
                geofences={geofences}
                performanceStage={performanceStage}
                selectedDrone={selectedDrone}
                freeMode={freeMode}
                showAllAssets={showAllAssets}
                selectedNavigationDirection={selectedNavigationDirection}
                isDriverModeEnabled={isDriverModeEnabled}
                isGeofenceModeEnabled={isGeofenceModeEnabled}
                driverWaypoints={driverWaypoints}
                onAddDriverWaypoint={handleAddDriverWaypoint}
                onSelectDrone={handleActivateDrone}
                isMissionModeEnabled={isMissionModeEnabled}
                geofenceDraftName={geofenceDraftName}
                geofenceDraftPoints={geofenceDraftPoints}
                isGeofenceSaving={isGeofenceSaving}
                geofenceError={geofenceError}
                onAddGeofenceVertex={handleAddGeofenceVertex}
                onUpdateGeofenceDraftName={handleUpdateGeofenceDraftName}
                onCompleteGeofenceDrawing={handleCompleteGeofenceDrawing}
                onCancelGeofenceDrawing={handleCancelGeofenceDrawing}
                missionWaypoints={mapMissionWaypoints}
                isMissionWaypointEditingEnabled={isMissionWaypointEditingEnabled}
                selectedMissionWaypointLocalId={selectedMissionWaypointLocalId}
                onAddMissionWaypoint={handleAddMissionWaypoint}
                onSelectMissionWaypoint={handleSelectMissionWaypoint}
                onMoveMissionWaypoint={handleMoveMissionWaypoint}
              />

              {!freeMode && isLiveVideoOpen && (
                <LiveVideoWindow
                  streamUrl={streamUrl}
                  isFetching={isFetching}
                  fetchError={fetchError}
                  onClose={handleCloseLiveVideo}
                />
              )}

              {geofenceAlerts.length > 0 && (
                <GeofenceAlertWindow alerts={geofenceAlerts} />
              )}

              {freeMode && showAllAssets && filteredBatteryAlerts.length > 0 && (
                <LowBatteryWindow alerts={filteredBatteryAlerts} />
              )}
            </>
          ) : (
            <AssetSelectionOverlay droneIds={droneIds} onSelectDrone={handleActivateDrone} />
          )}
        </main>

        {selectedDrone && !freeMode && !isMissionModeEnabled && (
          <SystemPanel
            telemetry={telemetry}
            history={history}
            connected={connected}
            onSendCommand={sendCommand}
            isCommandSending={isCommandSending}
            commandError={commandError}
            isDriverModeEnabled={isDriverModeEnabled}
            isDriverModeAvailable={isDriverModeAvailable}
            onToggleDriverMode={handleToggleDriverMode}
            driverWaypointCount={driverWaypoints.length}
          />
        )}

        {selectedDrone && !freeMode && isMissionModeEnabled && (
          <MissionPlanningPanel
            selectedDrone={selectedDrone}
            selectedMissionWaypointLocalId={selectedMissionWaypointLocalId}
            planningWaypoints={planningWaypoints}
            editingMissionId={editingMissionDraft?.missionId ?? null}
            editingMissionName={editingMissionDraft?.missionName ?? ''}
            editingWaypoints={editingMissionDraft?.waypoints ?? []}
            activeMission={activeMission}
            missions={missions}
            isLoading={isMissionLoading}
            missionError={missionError}
            onSelectMissionWaypoint={handleSelectMissionWaypoint}
            onRemovePlanningWaypoint={handleRemovePlanningWaypoint}
            onClearPlanningWaypoints={clearMissionPlanning}
            onSaveMission={handleSaveMission}
            onStartEditMission={handleStartEditMission}
            onCancelEditMission={handleCancelMissionEdit}
            onUpdateEditingMissionName={handleUpdateEditingMissionName}
            onSaveEditedMission={handleSaveEditedMission}
            onRemoveEditingWaypoint={handleRemoveEditingWaypoint}
            onNudgeMissionWaypoint={handleNudgeMissionWaypoint}
            onExecuteMission={handleExecuteMission}
            onAbortMission={handleAbortMission}
            onDeleteMission={handleDeleteMission}
          />
        )}
      </div>

      <StatusBar
        telemetry={telemetry}
        connected={connected}
        selectedDrone={selectedDrone}
        freeMode={freeMode}
        performanceStage={performanceStage}
        onCyclePerformanceStage={() => setPerformanceStage(getNextPerformanceStage)}
      />
    </div>
  );
}
