import { useState } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import Header from './components/Header';
import TelemetryPanel from './components/TelemetryPanel';
import MapComponent from './components/MapComponent';
import SystemPanel from './components/SystemPanel';
import StatusBar from './components/StatusBar';
import type { DroneId } from './interfaces/telemetry';

export default function App() {
  const [selectedDrone, setSelectedDrone] = useState<DroneId | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const { telemetry, connected, history } = useTelemetry(selectedDrone !== null, freeMode);
  const [lowPerf, setLowPerf] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-surface font-mono text-neon overflow-hidden select-none">
      <Header
        connected={connected}
        selectedDrone={selectedDrone}
        freeMode={freeMode}
        onToggleFreeMode={() => setFreeMode((value) => !value)}
        onDeselect={() => {
          setSelectedDrone(null);
          setFreeMode(false);
        }}
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
        </main>

        {selectedDrone && !freeMode && <SystemPanel telemetry={telemetry} history={history} connected={connected} />}
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
