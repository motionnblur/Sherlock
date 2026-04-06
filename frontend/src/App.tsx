import { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTelemetry } from './hooks/useTelemetry';
import { useStreamUrl } from './hooks/useStreamUrl';
import { useLastKnownTelemetry } from './hooks/useLastKnownTelemetry';
import { DRONE_IDS } from './constants/telemetry';
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
import type { DroneId } from './interfaces/telemetry';

const AUTH_LOGOUT_PATH = '/api/auth/logout';

export default function App() {
  const { authToken, logout } = useAuth();

  const [selectedDrone, setSelectedDrone] = useState<DroneId | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const [performanceStage, setPerformanceStage] = useState(PERFORMANCE_STAGE_NORMAL);
  const [isLiveVideoOpen, setIsLiveVideoOpen] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);

  const { telemetry, fleetTelemetry, connected, history, batteryAlerts } = useTelemetry(selectedDrone, freeMode, showAllAssets);
  const lastKnownTelemetry = useLastKnownTelemetry(DRONE_IDS, selectedDrone !== null);
  const { streamUrl, isFetching, fetchError, fetchStreamUrl, clearStreamUrl } = useStreamUrl();

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
      } else {
        setShowAllAssets(false);
      }
      return nextFreeMode;
    });
  }, [clearStreamUrl]);

  const handleToggleShowAllAssets = useCallback(() => {
    setShowAllAssets((current) => !current);
  }, []);

  const handleActivateDrone = useCallback((id: DroneId) => {
    setSelectedDrone(id);
    setFreeMode(false);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedDrone(null);
    setFreeMode(false);
    setIsLiveVideoOpen(false);
    clearStreamUrl();
  }, [clearStreamUrl]);

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
        onToggleFreeMode={handleToggleFreeMode}
        onDeselect={handleDeselect}
        onToggleLiveVideo={handleToggleLiveVideo}
        onToggleShowAllAssets={handleToggleShowAllAssets}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 min-h-0 border-t border-line">
        {selectedDrone && !freeMode && <TelemetryPanel telemetry={telemetry} />}

        <main className="flex-1 relative min-w-0">
          {selectedDrone ? (
            <>
              <MapComponent
                telemetry={telemetry}
                fleetTelemetry={fleetTelemetry}
                lastKnownTelemetry={lastKnownTelemetry}
                performanceStage={performanceStage}
                selectedDrone={selectedDrone}
                freeMode={freeMode}
                showAllAssets={showAllAssets}
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

              {freeMode && showAllAssets && batteryAlerts.length > 0 && (
                <LowBatteryWindow alerts={batteryAlerts} />
              )}
            </>
          ) : (
            <AssetSelectionOverlay onSelectDrone={handleActivateDrone} />
          )}
        </main>

        {selectedDrone && !freeMode && (
          <SystemPanel telemetry={telemetry} history={history} connected={connected} />
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
