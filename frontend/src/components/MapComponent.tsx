import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import mapSettings from '../../configs/map-settings.json';
import { PRIMARY_DRONE_ID } from '../constants/telemetry';
import type { MapComponentProps, MapSettingsConfig } from '../interfaces/components';
import type { TelemetryPoint } from '../interfaces/telemetry';
import { formatCoordinatePair, formatFixed } from '../utils/formatters';
import Drone from './Drone';

const ION_TOKEN = import.meta.env.VITE_CESIUM_TOKEN;
const HAS_TOKEN = Boolean(ION_TOKEN);
const typedMapSettings = mapSettings as MapSettingsConfig;
const MAP_DARKEN_PERCENT = Number.isFinite(typedMapSettings.darkenPercent)
  ? Math.max(0, Math.min(100, typedMapSettings.darkenPercent ?? 50))
  : 50;
const MAP_BRIGHTNESS = 1 - MAP_DARKEN_PERCENT / 100;

if (HAS_TOKEN) {
  Cesium.Ion.defaultAccessToken = ION_TOKEN;
}

function createViewer(container: HTMLElement): Cesium.Viewer {
  const viewer = new Cesium.Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    ...(HAS_TOKEN
      ? { terrain: Cesium.Terrain.fromWorldTerrain() }
      : {
          baseLayer: new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
              url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              credit: '© OpenStreetMap contributors',
              maximumLevel: 19,
            }),
          ),
        }),
  });

  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  );

  viewer.scene.globe.showGroundAtmosphere = false;
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = false;
  }

  const skyBox = viewer.scene.skyBox as unknown as { show?: boolean } | undefined;
  if (skyBox) {
    skyBox.show = false;
  }

  if (viewer.scene.sun) {
    viewer.scene.sun.show = false;
  }

  if (viewer.scene.moon) {
    viewer.scene.moon.show = false;
  }

  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050505');
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1628');
  viewer.scene.globe.depthTestAgainstTerrain = true;

  return viewer;
}

function applyImageryBrightness(viewer: Cesium.Viewer, brightness: number): void {
  for (let index = 0; index < viewer.imageryLayers.length; index += 1) {
    const layer = viewer.imageryLayers.get(index);
    if (layer) {
      layer.brightness = brightness;
    }
  }
}

function removeBuildings(
  viewer: Cesium.Viewer,
  buildingsRef: MutableRefObject<Cesium.Cesium3DTileset | null>,
): void {
  if (!buildingsRef.current) {
    return;
  }

  viewer.scene.primitives.remove(buildingsRef.current);
  buildingsRef.current = null;
}

async function ensureBuildings(
  viewer: Cesium.Viewer,
  buildingsRef: MutableRefObject<Cesium.Cesium3DTileset | null>,
  canAttachBuildings: () => boolean,
): Promise<void> {
  if (!HAS_TOKEN || buildingsRef.current) {
    return;
  }

  try {
    const buildings = await Cesium.createOsmBuildingsAsync({
      style: new Cesium.Cesium3DTileStyle({
        color: "color('#0d2a45', 0.85)",
      }),
    });

    if (viewer.isDestroyed() || buildingsRef.current || !canAttachBuildings()) {
      buildings.destroy();
      return;
    }

    viewer.scene.primitives.add(buildings);
    buildingsRef.current = buildings;
    viewer.scene.requestRender();
  } catch (error) {
    console.warn('[Sherlock] OSM Buildings failed to load:', error);
  }
}

function applyPerformanceProfile(viewer: Cesium.Viewer, lowPerf: boolean): void {
  const scene = viewer.scene;
  const globe = scene.globe;

  viewer.resolutionScale = 1;
  globe.enableLighting = false;
  globe.maximumScreenSpaceError = lowPerf ? 8 : 2;
  globe.depthTestAgainstTerrain = !lowPerf;
  scene.fog.enabled = false;
  (scene as unknown as { fxaa: boolean }).fxaa = !lowPerf;
  scene.requestRender();
}

function MapFrameOverlay({
  isMapDimmed,
}: {
  isMapDimmed: boolean;
}) {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,255,65,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.025)_1px,transparent_1px)] bg-[length:60px_60px]" />
      <div className="absolute top-2 left-2 w-5 h-5 border-t border-l border-neon opacity-40 pointer-events-none" />
      <div className="absolute top-2 right-2 w-5 h-5 border-t border-r border-neon opacity-40 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-neon opacity-40 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-neon opacity-40 pointer-events-none" />

      <div className="absolute top-3 right-3 pointer-events-none">
        <span className="text-[9px] tracking-widest text-muted">
          {isMapDimmed ? `MAP DIMMED ${MAP_DARKEN_PERCENT}%` : 'MAP NORMAL'}
        </span>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-[9px] text-muted tracking-widest">
          {HAS_TOKEN ? '3D TERRAIN + OSM BUILDINGS' : 'FLAT MAP MODE - ADD CESIUM TOKEN FOR 3D'}
        </span>
      </div>
    </>
  );
}

function SelectedTelemetryBanner({
  telemetry,
}: {
  telemetry: TelemetryPoint;
}) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel bg-opacity-80 border border-line px-3 py-1 text-[10px] tracking-widest pointer-events-none">
      <span className="text-muted">LAT </span>
      <span className="text-neon tabular-nums">{formatFixed(telemetry.latitude, 5)}</span>
      <span className="text-line mx-2">|</span>
      <span className="text-muted">LON </span>
      <span className="text-neon tabular-nums">{formatFixed(telemetry.longitude, 5)}</span>
      <span className="text-line mx-2">|</span>
      <span className="text-muted">ALT </span>
      <span className="text-neon tabular-nums">{formatFixed(telemetry.altitude, 0)}m</span>
    </div>
  );
}

function AssetSelectionOverlay({
  lastKnown,
  onSelectDrone,
}: {
  lastKnown: TelemetryPoint | null;
  onSelectDrone: (id: typeof PRIMARY_DRONE_ID) => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-panel border border-line w-64 pointer-events-auto shadow-[0_0_0_1px_rgba(0,255,65,0.08)]">
        <div className="px-3 py-2 bg-elevated border-b border-line">
          <span className="text-[10px] font-bold tracking-widest text-neon uppercase">
            ◈ SELECT ASSET
          </span>
        </div>

        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() => onSelectDrone(PRIMARY_DRONE_ID)}
            className="w-full text-left border border-line px-3 py-2.5 hover:bg-elevated hover:border-neon transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neon tracking-widest">{PRIMARY_DRONE_ID}</span>
              <span className="text-[9px] text-muted tracking-widest">▸ TRACK</span>
            </div>

            {lastKnown ? (
              <div className="text-[9px] text-muted space-y-0.5 tracking-wider">
                <div className="tabular-nums">{formatCoordinatePair(lastKnown.latitude, lastKnown.longitude)}</div>
                <div className="tabular-nums">
                  ALT {formatFixed(lastKnown.altitude, 0)}m
                  <span className="mx-1.5 text-line">·</span>
                  BAT {formatFixed(lastKnown.battery, 1)}%
                </div>
              </div>
            ) : (
              <div className="text-[9px] text-muted tracking-wider animate-pulse-fast">
                FETCHING LAST POSITION...
              </div>
            )}
          </button>
        </div>

        <div className="px-3 pb-2">
          <span className="text-[8px] text-muted tracking-widest">
            SELECT AN ASSET TO BEGIN TRACKING
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MapComponent({
  telemetry,
  lowPerf,
  selectedDrone,
  freeMode,
  onSelectDrone,
}: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const buildingsRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const lowPerfRef = useRef(lowPerf);

  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [isMapDimmed, setIsMapDimmed] = useState(false);
  const [lastKnown, setLastKnown] = useState<TelemetryPoint | null>(null);

  useEffect(() => {
    lowPerfRef.current = lowPerf;
  }, [lowPerf]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return;
    }

    const nextViewer = createViewer(containerRef.current);
    viewerRef.current = nextViewer;
    setViewer(nextViewer);
    applyImageryBrightness(nextViewer, 1);
    nextViewer.scene.requestRender();

    return () => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) {
        return;
      }

      removeBuildings(viewerRef.current, buildingsRef);
      viewerRef.current.destroy();
      viewerRef.current = null;
      setViewer(null);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key.toLowerCase() !== 'd') {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      setIsMapDimmed((currentValue) => !currentValue);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    applyImageryBrightness(viewer, isMapDimmed ? MAP_BRIGHTNESS : 1);
    viewer.scene.requestRender();
  }, [viewer, isMapDimmed]);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    applyPerformanceProfile(viewer, lowPerf);

    if (lowPerf) {
      removeBuildings(viewer, buildingsRef);
      return;
    }

    void ensureBuildings(viewer, buildingsRef, () => !lowPerfRef.current);
  }, [viewer, lowPerf]);

  return (
    <div className="relative w-full h-full bg-surface">
      <div ref={containerRef} className="w-full h-full" />

      <Drone
        viewer={viewer}
        telemetry={telemetry}
        selectedDrone={selectedDrone}
        freeMode={freeMode}
        lastKnown={lastKnown}
        onLastKnownChange={setLastKnown}
      />

      <MapFrameOverlay isMapDimmed={isMapDimmed} />

      {telemetry && selectedDrone && !freeMode && <SelectedTelemetryBanner telemetry={telemetry} />}
      {!selectedDrone && <AssetSelectionOverlay lastKnown={lastKnown} onSelectDrone={onSelectDrone} />}
    </div>
  );
}
