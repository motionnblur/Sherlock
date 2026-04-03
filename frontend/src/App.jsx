import { useState } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import Header from './components/Header';
import TelemetryPanel from './components/TelemetryPanel';
import MapComponent from './components/MapComponent';
import SystemPanel from './components/SystemPanel';
import StatusBar from './components/StatusBar';

export default function App() {
  const [selectedDrone, setSelectedDrone] = useState(null);
  const { telemetry, connected, history } = useTelemetry(selectedDrone !== null);
  const [lowPerf, setLowPerf] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-surface font-mono text-neon overflow-hidden select-none">
      <Header connected={connected} selectedDrone={selectedDrone} onDeselect={() => setSelectedDrone(null)} />

      <div className="flex flex-1 min-h-0 border-t border-line">
        {selectedDrone && <TelemetryPanel telemetry={telemetry} />}

        <main className="flex-1 relative min-w-0">
          <MapComponent
            telemetry={telemetry}
            lowPerf={lowPerf}
            selectedDrone={selectedDrone}
            onSelectDrone={setSelectedDrone}
          />
        </main>

        {selectedDrone && <SystemPanel telemetry={telemetry} history={history} connected={connected} />}
      </div>

      <StatusBar
        telemetry={telemetry}
        connected={connected}
        selectedDrone={selectedDrone}
        lowPerf={lowPerf}
        onToggleLowPerf={() => setLowPerf((v) => !v)}
      />
    </div>
  );
}
