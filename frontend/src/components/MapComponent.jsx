import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const ION_TOKEN = import.meta.env.VITE_CESIUM_TOKEN;
const HAS_TOKEN = !!ION_TOKEN;

if (HAS_TOKEN) {
  Cesium.Ion.defaultAccessToken = ION_TOKEN;
}

// SVG quadcopter icon encoded as a data URI
const DRONE_ICON = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <line x1="10" y1="10" x2="18" y2="18" stroke="#00FF41" stroke-width="1.5"/>
    <line x1="26" y1="10" x2="18" y2="18" stroke="#00FF41" stroke-width="1.5"/>
    <line x1="10" y1="26" x2="18" y2="18" stroke="#00FF41" stroke-width="1.5"/>
    <line x1="26" y1="26" x2="18" y2="18" stroke="#00FF41" stroke-width="1.5"/>
    <circle cx="18" cy="18" r="4" fill="#00FF41" opacity="0.9"/>
    <circle cx="18" cy="18" r="6" fill="none" stroke="#00FF41" stroke-width="0.8" opacity="0.4"/>
    <circle cx="10" cy="10" r="4" fill="none" stroke="#00FF41" stroke-width="1.5"/>
    <circle cx="26" cy="10" r="4" fill="none" stroke="#00FF41" stroke-width="1.5"/>
    <circle cx="10" cy="26" r="4" fill="none" stroke="#00FF41" stroke-width="1.5"/>
    <circle cx="26" cy="26" r="4" fill="none" stroke="#00FF41" stroke-width="1.5"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
})();

function createViewer(container) {
  const options = {
    animation:                              false,
    baseLayerPicker:                        false,
    fullscreenButton:                       false,
    geocoder:                               false,
    homeButton:                             false,
    infoBox:                                false,
    sceneModePicker:                        false,
    selectionIndicator:                     false,
    timeline:                               false,
    navigationHelpButton:                   false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly:                            true,
    requestRenderMode:                      false,
  };

  if (HAS_TOKEN) {
    // Cesium Ion: Bing Maps satellite imagery (default) + World Terrain
    options.terrain = Cesium.Terrain.fromWorldTerrain();
  } else {
    // No token: OpenStreetMap flat tiles as fallback
    options.baseLayer = new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url:          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit:       '© OpenStreetMap contributors',
        maximumLevel: 19,
      })
    );
  }

  const viewer = new Cesium.Viewer(container, options);

  // Atmosphere & sky — disabled for clean dark military aesthetic
  viewer.scene.globe.showGroundAtmosphere    = false;
  viewer.scene.skyAtmosphere.show            = false;
  viewer.scene.skyBox.show                   = false;
  viewer.scene.sun.show                      = false;
  viewer.scene.moon.show                     = false;
  viewer.scene.backgroundColor               = Cesium.Color.fromCssColorString('#050505');
  viewer.scene.globe.baseColor               = Cesium.Color.fromCssColorString('#0a1628');

  // Depth test so the drone label always renders on top of terrain
  viewer.scene.globe.depthTestAgainstTerrain = true;

  return viewer;
}

async function addOsmBuildings(viewer) {
  // Cesium Ion asset 96188 — OpenStreetMap Buildings (free tier)
  const buildings = await Cesium.createOsmBuildingsAsync({
    style: new Cesium.Cesium3DTileStyle({
      // Dark navy tint to blend with the military dark theme
      color: "color('#0d2a45', 0.85)",
    }),
  });
  viewer.scene.primitives.add(buildings);
  return buildings;
}

export default function MapComponent({ telemetry }) {
  const containerRef = useRef(null);
  const viewerRef    = useRef(null);
  const droneRef     = useRef(null);
  const pathRef      = useRef(null);
  const positionsRef = useRef([]);
  const initialFlown = useRef(false);

  // Initialize viewer once
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = createViewer(containerRef.current);
    viewerRef.current = viewer;

    // Add 3D OSM buildings when Ion token is present
    if (HAS_TOKEN) {
      addOsmBuildings(viewer).catch((err) =>
        console.warn('[Sherlock] OSM Buildings failed to load:', err)
      );
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      droneRef.current  = null;
      pathRef.current   = null;
      positionsRef.current = [];
      initialFlown.current = false;
    };
  }, []);

  // Update drone position on every telemetry tick
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !telemetry) return;

    const cartesian = Cesium.Cartesian3.fromDegrees(
      telemetry.longitude,
      telemetry.latitude,
      telemetry.altitude,
    );

    positionsRef.current.push(cartesian);
    if (positionsRef.current.length > 200) positionsRef.current.shift();

    if (!droneRef.current) {
      // ── Drone entity ──────────────────────────────────────────────────────
      droneRef.current = viewer.entities.add({
        name: 'SHERLOCK-01',
        position: cartesian,
        billboard: {
          image:            DRONE_ICON,
          scale:            0.9,
          verticalOrigin:   Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          heightReference:  Cesium.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text:             '◆ SHERLOCK-01',
          font:             '11px "JetBrains Mono", monospace',
          fillColor:        Cesium.Color.fromCssColorString('#00FF41'),
          outlineColor:     Cesium.Color.BLACK,
          outlineWidth:     2,
          style:            Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin:   Cesium.VerticalOrigin.BOTTOM,
          pixelOffset:      new Cesium.Cartesian2(0, -22),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 600000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // ── Flight path polyline ──────────────────────────────────────────────
      pathRef.current = viewer.entities.add({
        name: 'flight-path',
        polyline: {
          positions: new Cesium.CallbackProperty(() => [...positionsRef.current], false),
          width:     1.5,
          material:  new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.15,
            color:     Cesium.Color.fromCssColorString('#00FF41').withAlpha(0.65),
          }),
          clampToGround: false,
          arcType:       Cesium.ArcType.NONE,
        },
      });

      // ── Initial camera fly-to ─────────────────────────────────────────────
      if (!initialFlown.current) {
        initialFlown.current = true;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            telemetry.longitude,
            telemetry.latitude,
            8000,                          // closer to see buildings
          ),
          duration: 2.5,
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch:   Cesium.Math.toRadians(-35),
            roll:    0,
          },
        });
      }
    } else {
      droneRef.current.position = new Cesium.ConstantPositionProperty(cartesian);
    }
  }, [telemetry]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Subtle scan-line grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,65,0.025) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(0,255,65,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-2 left-2 w-5 h-5 border-t border-l border-neon opacity-40 pointer-events-none" />
      <div className="absolute top-2 right-2 w-5 h-5 border-t border-r border-neon opacity-40 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-neon opacity-40 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-neon opacity-40 pointer-events-none" />

      {/* 3D mode badge */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-[9px] text-muted tracking-widest">
          {HAS_TOKEN ? '3D TERRAIN + OSM BUILDINGS' : 'FLAT MAP MODE — ADD CESIUM TOKEN FOR 3D'}
        </span>
      </div>

      {/* Position overlay */}
      {telemetry && (
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
    </div>
  );
}
