import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import mapSettings from '../../configs/map-settings.json';
import Drone from './Drone';
import type { MapComponentProps, MapSettingsConfig } from '../interfaces/components';
import type { TelemetryPoint } from '../interfaces/telemetry';

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
  const options: Cesium.Viewer.ConstructorOptions = {
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
  };

  if (HAS_TOKEN) {
    options.terrain = Cesium.Terrain.fromWorldTerrain();
  } else {
    options.baseLayer = new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: '© OpenStreetMap contributors',
        maximumLevel: 19,
      }),
    );
  }

  const viewer = new Cesium.Viewer(container, options);
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
  for (let i = 0; i < viewer.imageryLayers.length; i += 1) {
    const layer = viewer.imageryLayers.get(i);
    if (layer) {
      layer.brightness = brightness;
    }
  }
}

async function addOsmBuildings(viewer: Cesium.Viewer): Promise<Cesium.Cesium3DTileset> {
  const buildings = await Cesium.createOsmBuildingsAsync({
    style: new Cesium.Cesium3DTileStyle({
      color: "color('#0d2a45', 0.85)",
    }),
  });

  viewer.scene.primitives.add(buildings);
  return buildings;
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

  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [isMapDimmed, setIsMapDimmed] = useState(false);
  const [lastKnown, setLastKnown] = useState<TelemetryPoint | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = createViewer(containerRef.current);
    viewerRef.current = viewer;
    setViewer(viewer);
    applyImageryBrightness(viewer, 1);

    if (HAS_TOKEN) {
      addOsmBuildings(viewer).catch((err) =>
        console.warn('[Sherlock] OSM Buildings failed to load:', err),
      );
    }

    viewer.scene.requestRender();

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      setViewer(null);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key.toLowerCase() !== 'd') return;

      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      setIsMapDimmed((current) => !current);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    applyImageryBrightness(viewer, isMapDimmed ? MAP_BRIGHTNESS : 1);
    viewer.scene.requestRender();
  }, [isMapDimmed]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const scene = viewer.scene;
    const globe = scene.globe;

    if (lowPerf) {
      viewer.resolutionScale = 1;
      globe.maximumScreenSpaceError = 8;
      globe.enableLighting = false;
      scene.fog.enabled = false;
      (scene as unknown as { fxaa: boolean }).fxaa = false;

      const primitives = scene.primitives;
      for (let i = primitives.length - 1; i >= 0; i -= 1) {
        const primitive = primitives.get(i);
        if (primitive instanceof Cesium.Cesium3DTileset) {
          primitives.remove(primitive);
        }
      }

      if (!HAS_TOKEN) {
        globe.depthTestAgainstTerrain = false;
      }
    } else {
      viewer.resolutionScale = 1;
      globe.maximumScreenSpaceError = 2;
      scene.fog.enabled = false;
      (scene as unknown as { fxaa: boolean }).fxaa = true;
      globe.depthTestAgainstTerrain = true;

      if (HAS_TOKEN) {
        addOsmBuildings(viewer).catch((err) =>
          console.warn('[Sherlock] OSM Buildings reload failed:', err),
        );
      }
    }

    scene.requestRender();
  }, [lowPerf]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <Drone
        viewer={viewer}
        telemetry={telemetry}
        selectedDrone={selectedDrone}
        freeMode={freeMode}
        lastKnown={lastKnown}
        onLastKnownChange={setLastKnown}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,65,0.025) 1px, transparent 1px), '
            + 'linear-gradient(90deg, rgba(0,255,65,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

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

      {telemetry && selectedDrone && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel bg-opacity-80 border border-line px-3 py-1 text-[10px] tracking-widest pointer-events-none">
          <span className="text-muted">LAT </span>
          <span className="text-neon tabular-nums">{telemetry.latitude?.toFixed(5)}</span>
          <span className="text-line mx-2">|</span>
          <span className="text-muted">LON </span>
          <span className="text-neon tabular-nums">{telemetry.longitude?.toFixed(5)}</span>
          <span className="text-line mx-2">|</span>
          <span className="text-muted">ALT </span>
          <span className="text-neon tabular-nums">{telemetry.altitude?.toFixed(0)}m</span>
        </div>
      )}

      {!selectedDrone && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(5,5,5,0.55)' }}
        >
          <div className="bg-panel border border-line w-64 pointer-events-auto">
            <div className="px-3 py-2 bg-elevated border-b border-line">
              <span className="text-[10px] font-bold tracking-widest text-neon uppercase">
                ◈ SELECT ASSET
              </span>
            </div>

            <div className="px-3 py-3">
              <button
                onClick={() => onSelectDrone('SHERLOCK-01')}
                className="w-full text-left border border-line px-3 py-2.5 hover:bg-elevated hover:border-neon transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neon tracking-widest">SHERLOCK-01</span>
                  <span className="text-[9px] text-muted tracking-widest">▸ TRACK</span>
                </div>

                {lastKnown ? (
                  <div className="text-[9px] text-muted space-y-0.5 tracking-wider">
                    <div className="tabular-nums">
                      {Math.abs(lastKnown.latitude)?.toFixed(4)}°{lastKnown.latitude >= 0 ? 'N' : 'S'}{' '}
                      {Math.abs(lastKnown.longitude)?.toFixed(4)}°{lastKnown.longitude >= 0 ? 'E' : 'W'}
                    </div>
                    <div className="tabular-nums">
                      ALT {lastKnown.altitude?.toFixed(0)}m
                      <span className="mx-1.5 text-line">·</span>
                      BAT {lastKnown.battery?.toFixed(1)}%
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
      )}
    </div>
  );
}
