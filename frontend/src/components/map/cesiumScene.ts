import type { MutableRefObject } from 'react';
import * as Cesium from 'cesium';
import mapSettings from '../../../configs/map-settings.json';
import type { DroneId, TelemetryPoint } from '../../interfaces/telemetry';
import type { MapSettingsConfig } from '../../interfaces/components';

const ION_TOKEN = import.meta.env.VITE_CESIUM_TOKEN;
export const HAS_TOKEN = Boolean(ION_TOKEN);
const typedMapSettings = mapSettings as MapSettingsConfig;
export const MAP_DARKEN_PERCENT = Number.isFinite(typedMapSettings.darkenPercent)
  ? Math.max(0, Math.min(100, typedMapSettings.darkenPercent ?? 50))
  : 50;
export const MAP_BRIGHTNESS = 1 - MAP_DARKEN_PERCENT / 100;

const CAMERA_FLY_ALTITUDE = 8000;
const FLEET_POINT_SIZE = 1;
const NEON = Cesium.Color.fromCssColorString('#00FF41');
const NEON_LIGHT = Cesium.Color.fromCssColorString('#66FF99');
const MUTED = Cesium.Color.fromCssColorString('#3d4f63');
const DANGER = Cesium.Color.fromCssColorString('#FF3B30');

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

const DRONE_ICON_RED = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <line x1="10" y1="10" x2="18" y2="18" stroke="#FF3B30" stroke-width="1.5"/>
    <line x1="26" y1="10" x2="18" y2="18" stroke="#FF3B30" stroke-width="1.5"/>
    <line x1="10" y1="26" x2="18" y2="18" stroke="#FF3B30" stroke-width="1.5"/>
    <line x1="26" y1="26" x2="18" y2="18" stroke="#FF3B30" stroke-width="1.5"/>
    <circle cx="18" cy="18" r="4" fill="#FF3B30" opacity="0.9"/>
    <circle cx="18" cy="18" r="6" fill="none" stroke="#FF3B30" stroke-width="0.8" opacity="0.4"/>
    <circle cx="10" cy="10" r="4" fill="none" stroke="#FF3B30" stroke-width="1.5"/>
    <circle cx="26" cy="10" r="4" fill="none" stroke="#FF3B30" stroke-width="1.5"/>
    <circle cx="10" cy="26" r="4" fill="none" stroke="#FF3B30" stroke-width="1.5"/>
    <circle cx="26" cy="26" r="4" fill="none" stroke="#FF3B30" stroke-width="1.5"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
})();

if (HAS_TOKEN) {
  Cesium.Ion.defaultAccessToken = ION_TOKEN;
}

export function createViewer(container: HTMLElement): Cesium.Viewer {
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

export function applyImageryBrightness(viewer: Cesium.Viewer, brightness: number): void {
  for (let index = 0; index < viewer.imageryLayers.length; index += 1) {
    const layer = viewer.imageryLayers.get(index);
    if (layer) {
      layer.brightness = brightness;
    }
  }
}

export function removeBuildings(
  viewer: Cesium.Viewer,
  buildingsRef: MutableRefObject<Cesium.Cesium3DTileset | null>,
): void {
  if (buildingsRef.current) {
    viewer.scene.primitives.remove(buildingsRef.current);
    buildingsRef.current = null;
  }
}

export async function ensureBuildings(
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

export function applyPerformanceProfile(viewer: Cesium.Viewer, lowPerf: boolean): void {
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

export function toCartesian(point: TelemetryPoint): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitude);
}

export function flyToAsset(viewer: Cesium.Viewer, point: TelemetryPoint, onComplete?: () => void): void {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, CAMERA_FLY_ALTITUDE),
    duration: 2.5,
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
    complete: onComplete,
    cancel: onComplete,
  });
}

export function ensureSelectedDroneEntity(
  viewer: Cesium.Viewer,
  droneId: DroneId,
  position: Cesium.Cartesian3,
  selectedDroneRef: MutableRefObject<Cesium.Entity | null>,
): Cesium.Entity {
  if (!selectedDroneRef.current) {
    selectedDroneRef.current = viewer.entities.add({
      name: droneId,
      position,
      billboard: {
        image: DRONE_ICON,
        scale: 0.9,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `◆ ${droneId}`,
        font: '11px "JetBrains Mono", monospace',
        fillColor: NEON,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -22),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 600000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    return selectedDroneRef.current;
  }

  selectedDroneRef.current.position = new Cesium.ConstantPositionProperty(position);
  selectedDroneRef.current.name = droneId;
  return selectedDroneRef.current;
}

export function ensurePathEntity(
  viewer: Cesium.Viewer,
  droneId: DroneId,
  selectedPathRef: MutableRefObject<Cesium.Entity | null>,
  pathPositionsRef: MutableRefObject<Cesium.Cartesian3[]>,
): Cesium.Entity {
  if (selectedPathRef.current) {
    return selectedPathRef.current;
  }

  selectedPathRef.current = viewer.entities.add({
    name: `flight-path-${droneId}`,
    polyline: {
      positions: new Cesium.CallbackProperty(() => [...pathPositionsRef.current], false),
      width: 1.5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.15,
        color: NEON.withAlpha(0.65),
      }),
      clampToGround: false,
      arcType: Cesium.ArcType.NONE,
    },
  });

  return selectedPathRef.current;
}

export function resetSelectedEntities(
  viewer: Cesium.Viewer,
  selectedDroneRef: MutableRefObject<Cesium.Entity | null>,
  selectedPathRef: MutableRefObject<Cesium.Entity | null>,
  pathPositionsRef: MutableRefObject<Cesium.Cartesian3[]>,
): void {
  if (viewer.trackedEntity === selectedDroneRef.current) {
    viewer.camera.cancelFlight();
    viewer.trackedEntity = undefined;
  }

  if (selectedDroneRef.current) {
    viewer.entities.remove(selectedDroneRef.current);
    selectedDroneRef.current = null;
  }
  if (selectedPathRef.current) {
    viewer.entities.remove(selectedPathRef.current);
    selectedPathRef.current = null;
  }
  pathPositionsRef.current = [];
  viewer.scene.requestRender();
}

export interface FleetAssetPrimitives {
  point: Cesium.PointPrimitive;
  billboard: Cesium.Billboard;
  polyline: Cesium.Polyline;
  label: Cesium.Label;
  positions: Cesium.Cartesian3[];
}

export function ensureFleetCollections(
  viewer: Cesium.Viewer,
  pointCollectionRef: MutableRefObject<Cesium.PointPrimitiveCollection | null>,
  billboardCollectionRef: MutableRefObject<Cesium.BillboardCollection | null>,
  polylineCollectionRef: MutableRefObject<Cesium.PolylineCollection | null>,
  labelCollectionRef: MutableRefObject<Cesium.LabelCollection | null>,
): { pointCollection: Cesium.PointPrimitiveCollection; billboardCollection: Cesium.BillboardCollection; polylineCollection: Cesium.PolylineCollection; labelCollection: Cesium.LabelCollection } {
  if (!pointCollectionRef.current) {
    pointCollectionRef.current = viewer.scene.primitives.add(
      new Cesium.PointPrimitiveCollection(),
    ) as Cesium.PointPrimitiveCollection;
  }
  if (!billboardCollectionRef.current) {
    billboardCollectionRef.current = viewer.scene.primitives.add(
      new Cesium.BillboardCollection(),
    ) as Cesium.BillboardCollection;
  }
  if (!polylineCollectionRef.current) {
    polylineCollectionRef.current = viewer.scene.primitives.add(
      new Cesium.PolylineCollection(),
    ) as Cesium.PolylineCollection;
  }
  if (!labelCollectionRef.current) {
    labelCollectionRef.current = viewer.scene.primitives.add(
      new Cesium.LabelCollection(),
    ) as Cesium.LabelCollection;
  }
  return {
    pointCollection: pointCollectionRef.current,
    billboardCollection: billboardCollectionRef.current,
    polylineCollection: polylineCollectionRef.current,
    labelCollection: labelCollectionRef.current,
  };
}

export function upsertFleetAsset(
  pointCollection: Cesium.PointPrimitiveCollection,
  billboardCollection: Cesium.BillboardCollection,
  polylineCollection: Cesium.PolylineCollection,
  labelCollection: Cesium.LabelCollection,
  assetMapRef: MutableRefObject<Map<DroneId, FleetAssetPrimitives>>,
  droneId: DroneId,
  telemetryPoint: TelemetryPoint,
): void {
  const position = toCartesian(telemetryPoint);
  const existing = assetMapRef.current.get(droneId);
  if (existing) {
    existing.point.position = position;
    existing.billboard.position = position;
    existing.label.position = position;
    existing.positions.push(position);
    if (existing.positions.length > 25) {
      existing.positions.shift();
    }
    existing.polyline.positions = existing.positions;
    return;
  }

  const point = pointCollection.add({
    position,
    pixelSize: FLEET_POINT_SIZE + 1.5,
    color: DANGER.withAlpha(0.9),
    outlineColor: DANGER,
    outlineWidth: 1,
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(8000, Number.POSITIVE_INFINITY),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });

  const billboard = billboardCollection.add({
    position,
    image: DRONE_ICON_RED,
    scale: 0.9,
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });

  const polyline = polylineCollection.add({
    positions: [position],
    width: 1.5,
    material: Cesium.Material.fromType('PolylineGlow', { glowPower: 0.15, color: DANGER.withAlpha(0.65) }),
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000),
  });

  const label = labelCollection.add({
    position,
    text: `◆ ${droneId}`,
    font: '11px "JetBrains Mono", monospace',
    fillColor: DANGER,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, -22),
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });

  assetMapRef.current.set(droneId, { point, billboard, polyline, label, positions: [position] });
}
