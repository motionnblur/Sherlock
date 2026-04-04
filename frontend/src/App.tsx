import { useState, useCallback } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import { useStreamUrl } from './hooks/useStreamUrl';
import Header from './components/Header';
import TelemetryPanel from './components/TelemetryPanel';
import MapComponent from './components/MapComponent';
import SystemPanel from './components/SystemPanel';
import StatusBar from './components/StatusBar';
import LiveVideoWindow from './components/LiveVideoWindow';
import type { DroneId } from './interfaces/telemetry';

export default function App() {
  const [selectedDrone, setSelectedDrone] = useState<DroneId | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const [lowPerf, setLowPerf] = useState(false);
  const [isLiveVideoOpen, setIsLiveVideoOpen] = useState(false);

  const { telemetry, connected, history } = useTelemetry(selectedDrone !== null, freeMode);
  const { streamUrl, isFetching, fetchError, fetchStreamUrl, clearStreamUrl } = useStreamUrl();

  const handleToggleLiveVideo = useCallback(() => {
    if (!selectedDrone) return;

    if (isLiveVideoOpen) {
      setIsLiveVideoOpen(false);
      clearStreamUrl();
    } else {
      setIsLiveVideoOpen(true);
      fetchStreamUrl(selectedDrone);
    }
  }, [isLiveVideoOpen, selectedDrone, fetchStreamUrl, clearStreamUrl]);

  const handleCloseLiveVideo = useCallback(() => {
    setIsLiveVideoOpen(false);
    clearStreamUrl();
  }, [clearStreamUrl]);

  const handleDeselect = useCallback(() => {
    setSelectedDrone(null);
    setFreeMode(false);
    setIsLiveVideoOpen(false);
    clearStreamUrl();
  }, [clearStreamUrl]);

  return (
    <div className="h-screen flex flex-col bg-surface font-mono text-neon overflow-hidden select-none">
      <Header
        connected={connected}
        selectedDrone={selectedDrone}
        freeMode={freeMode}
        isLiveVideoOpen={isLiveVideoOpen}
        onToggleFreeMode={() => setFreeMode((value) => !value)}
        onDeselect={handleDeselect}
        onToggleLiveVideo={handleToggleLiveVideo}
      />

      <div className="flex flex-1 min-h-0 border-t border-line">
        {selectedDrone && !freeMode && <TelemetryPanel telemetry={telemetry} />}

        <main className="flex-1 relative min-w-0">
          <MapComponent
            telemetry={telemetry}
            lowPerf={lowPerf}
            selectedDrone={selectedDrone}
            freeMode={freeMode}
            onSelectDrone={(id) => setSelectedDrone(id)}
          />

          {selectedDrone && isLiveVideoOpen && (
            <LiveVideoWindow
              streamUrl={streamUrl}
              isFetching={isFetching}
              fetchError={fetchError}
              onClose={handleCloseLiveVideo}
            />
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
        lowPerf={lowPerf}
        onToggleLowPerf={() => setLowPerf((value) => !value)}
      />
    </div>
  );
}
