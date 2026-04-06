import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTelemetry } from './hooks/useTelemetry';
import { useStreamUrl } from './hooks/useStreamUrl';
import { useLastKnownTelemetry } from './hooks/useLastKnownTelemetry';
import { useCommand } from './hooks/useCommand';
import { useDroneRegistry } from './hooks/useDroneRegistry';
import {
  DRIVER_DEFAULT_ALTITUDE_METERS,
  DRIVER_REACHED_HORIZONTAL_METERS,
  DRIVER_REACHED_VERTICAL_METERS,
} from './constants/driver';
import { NAVIGATION_DIRECTION_ALL } from './constants/navigation';
import {
  getNextPerformanceStage,
  PERFORMANCE_STAGE_NORMAL,
} from './constants/performance';
import Header from './components/Header';
import TelemetryPanel from './components/TelemetryPanel';
import MapComponent from './components/MapComponent';
import SystemPanel from './components/SystemPanel';
import StatusBar from './components/StatusBar';
import LiveVideoWindow from './components/LiveVideoWindow';
import LoginPage from './components/LoginPage';
import AssetSelectionOverlay from './components/AssetSelectionOverlay';
import LowBatteryWindow from './components/LowBatteryWindow';
import type { DriverWaypoint, DroneId, NavigationDirection } from './interfaces/telemetry';
import { horizontalDistanceMeters } from './utils/geo';
import { matchesNavigationDirection } from './utils/navigation';

const AUTH_LOGOUT_PATH = '/api/auth/logout';

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

  const { droneIds } = useDroneRegistry(authToken);
  const { telemetry, fleetTelemetry, connected, history, batteryAlerts } = useTelemetry(selectedDrone, freeMode, showAllAssets);
  const lastKnownTelemetry = useLastKnownTelemetry(droneIds, selectedDrone !== null);
  const { streamUrl, isFetching, fetchError, fetchStreamUrl, clearStreamUrl } = useStreamUrl();
  const { sendCommand, isSending: isCommandSending, commandError } = useCommand(selectedDrone, authToken);
  const isDriverModeAvailable = Boolean(selectedDrone?.startsWith('MAVLINK-')) && !freeMode;

  const resetNavigationDirection = useCallback(() => {
    setSelectedNavigationDirection(NAVIGATION_DIRECTION_ALL);
  }, []);

  const clearDriverRoute = useCallback(() => {
    setDriverWaypoints([]);
    driverDispatchInFlightRef.current = false;
  }, []);

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
      } else {
        setShowAllAssets(false);
        resetNavigationDirection();
      }
      return nextFreeMode;
    });
  }, [clearDriverRoute, clearStreamUrl, resetNavigationDirection]);

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
    resetNavigationDirection();
  }, [clearDriverRoute, resetNavigationDirection]);

  const handleDeselect = useCallback(() => {
    setSelectedDrone(null);
    setFreeMode(false);
    setIsDriverModeEnabled(false);
    setIsLiveVideoOpen(false);
    clearStreamUrl();
    setShowAllAssets(false);
    clearDriverRoute();
    resetNavigationDirection();
  }, [clearDriverRoute, clearStreamUrl, resetNavigationDirection]);

  const handleToggleDriverMode = useCallback(() => {
    if (!isDriverModeAvailable) {
      return;
    }
    setIsDriverModeEnabled((currentMode) => {
      const nextMode = !currentMode;
      if (!nextMode) {
        clearDriverRoute();
      }
      return nextMode;
    });
  }, [clearDriverRoute, isDriverModeAvailable]);

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
        onToggleFreeMode={handleToggleFreeMode}
        onDeselect={handleDeselect}
        onToggleLiveVideo={handleToggleLiveVideo}
        onToggleShowAllAssets={handleToggleShowAllAssets}
        onSelectNavigationDirection={setSelectedNavigationDirection}
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
                performanceStage={performanceStage}
                selectedDrone={selectedDrone}
                freeMode={freeMode}
                showAllAssets={showAllAssets}
                selectedNavigationDirection={selectedNavigationDirection}
                isDriverModeEnabled={isDriverModeEnabled}
                driverWaypoints={driverWaypoints}
                onAddDriverWaypoint={handleAddDriverWaypoint}
                onSelectDrone={handleActivateDrone}
              />

              {!freeMode && isLiveVideoOpen && (
                <LiveVideoWindow
                  streamUrl={streamUrl}
                  isFetching={isFetching}
                  fetchError={fetchError}
                  onClose={handleCloseLiveVideo}
                />
              )}

              {freeMode && showAllAssets && filteredBatteryAlerts.length > 0 && (
                <LowBatteryWindow alerts={filteredBatteryAlerts} />
              )}
            </>
          ) : (
            <AssetSelectionOverlay droneIds={droneIds} onSelectDrone={handleActivateDrone} />
          )}
        </main>

        {selectedDrone && !freeMode && (
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
