import { useEffect, useRef, type MutableRefObject } from 'react';
import * as Cesium from 'cesium';
import { FLIGHT_PATH_POINT_LIMIT, PRIMARY_DRONE_ID, PRIMARY_DRONE_LABEL } from '../constants/telemetry';
import type { DroneProps } from '../interfaces/components';
import type { TelemetryPoint } from '../interfaces/telemetry';
import { getLastTelemetryPoint } from '../utils/telemetry';

const NEON = Cesium.Color.fromCssColorString('#00FF41');
const MUTED = Cesium.Color.fromCssColorString('#3d4f63');

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

type DroneVisualMode = 'static' | 'live';

function toCartesian(point: TelemetryPoint): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitude);
}

function flyToAsset(
  viewer: Cesium.Viewer,
  longitude: number,
  latitude: number,
  onComplete?: () => void,
): void {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 8000),
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

function createDroneEntity(
  viewer: Cesium.Viewer,
  position: Cesium.Cartesian3,
  mode: DroneVisualMode,
): Cesium.Entity {
  const isLive = mode === 'live';

  return viewer.entities.add({
    name: PRIMARY_DRONE_ID,
    position,
    billboard: {
      image: DRONE_ICON,
      scale: 0.9,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      heightReference: Cesium.HeightReference.NONE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      color: isLive ? undefined : NEON.withAlpha(0.45),
    },
    label: {
      text: PRIMARY_DRONE_LABEL,
      font: '11px "JetBrains Mono", monospace',
      fillColor: isLive ? NEON : MUTED,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -22),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 600000),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

function removeEntity(viewer: Cesium.Viewer, entity: Cesium.Entity | null): null {
  if (entity) {
    viewer.entities.remove(entity);
  }

  return null;
}

function ensureLiveDroneEntity(
  viewer: Cesium.Viewer,
  currentEntity: Cesium.Entity | null,
  position: Cesium.Cartesian3,
): Cesium.Entity {
  if (!currentEntity) {
    return createDroneEntity(viewer, position, 'live');
  }

  currentEntity.position = new Cesium.ConstantPositionProperty(position);
  return currentEntity;
}

function ensurePathEntity(
  viewer: Cesium.Viewer,
  currentPath: Cesium.Entity | null,
  positionsRef: MutableRefObject<Cesium.Cartesian3[]>,
): Cesium.Entity {
  if (currentPath) {
    return currentPath;
  }

  return viewer.entities.add({
    name: 'flight-path',
    polyline: {
      positions: new Cesium.CallbackProperty(() => [...positionsRef.current], false),
      width: 1.5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.15,
        color: NEON.withAlpha(0.65),
      }),
      clampToGround: false,
      arcType: Cesium.ArcType.NONE,
    },
  });
}

async function fetchLastKnownTelemetry(signal: AbortSignal): Promise<TelemetryPoint | null> {
  const response = await fetch('/api/telemetry/history', { signal });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  return getLastTelemetryPoint(payload);
}

export default function Drone({
  viewer,
  telemetry,
  selectedDrone,
  freeMode,
  lastKnown,
  onLastKnownChange,
}: DroneProps) {
  const droneRef = useRef<Cesium.Entity | null>(null);
  const pathRef = useRef<Cesium.Entity | null>(null);
  const positionsRef = useRef<Cesium.Cartesian3[]>([]);
  const initialFlownRef = useRef(false);
  const initialCenteringRef = useRef(false);
  const freeModeRef = useRef(freeMode);

  const resetSceneEntities = (mapViewer: Cesium.Viewer) => {
    mapViewer.camera.cancelFlight();
    mapViewer.trackedEntity = undefined;
    droneRef.current = removeEntity(mapViewer, droneRef.current);
    pathRef.current = removeEntity(mapViewer, pathRef.current);
    positionsRef.current = [];
    initialFlownRef.current = false;
    initialCenteringRef.current = false;
    mapViewer.scene.requestRender();
  };

  const centerOnPoint = (mapViewer: Cesium.Viewer, point: TelemetryPoint) => {
    if (initialFlownRef.current || initialCenteringRef.current) {
      return;
    }

    initialCenteringRef.current = true;
    mapViewer.trackedEntity = undefined;

    flyToAsset(mapViewer, point.longitude, point.latitude, () => {
      if (mapViewer.isDestroyed()) {
        return;
      }

      initialCenteringRef.current = false;
      initialFlownRef.current = true;

      if (selectedDrone && !freeModeRef.current && droneRef.current) {
        mapViewer.trackedEntity = droneRef.current;
      }

      mapViewer.scene.requestRender();
    });
  };

  useEffect(() => {
    freeModeRef.current = freeMode;
  }, [freeMode]);

  useEffect(() => {
    if (selectedDrone) {
      return;
    }

    const abortController = new AbortController();
    onLastKnownChange(null);

    fetchLastKnownTelemetry(abortController.signal)
      .then((point) => {
        if (!abortController.signal.aborted) {
          onLastKnownChange(point);
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          onLastKnownChange(null);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [selectedDrone, onLastKnownChange]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    resetSceneEntities(viewer);
  }, [viewer, selectedDrone]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || selectedDrone || !lastKnown) {
      return;
    }

    const position = toCartesian(lastKnown);
    droneRef.current = removeEntity(viewer, droneRef.current);
    droneRef.current = createDroneEntity(viewer, position, 'static');
    centerOnPoint(viewer, lastKnown);
    viewer.scene.requestRender();
  }, [viewer, selectedDrone, lastKnown]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedDrone || !lastKnown) {
      return;
    }

    const position = toCartesian(lastKnown);
    if (positionsRef.current.length === 0) {
      positionsRef.current.push(position);
    }

    droneRef.current = ensureLiveDroneEntity(viewer, droneRef.current, position);
    pathRef.current = ensurePathEntity(viewer, pathRef.current, positionsRef);
    centerOnPoint(viewer, lastKnown);
    viewer.scene.requestRender();
  }, [viewer, selectedDrone, lastKnown]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !telemetry || !selectedDrone) {
      return;
    }

    const position = toCartesian(telemetry);
    positionsRef.current.push(position);
    if (positionsRef.current.length > FLIGHT_PATH_POINT_LIMIT) {
      positionsRef.current.shift();
    }

    droneRef.current = ensureLiveDroneEntity(viewer, droneRef.current, position);
    pathRef.current = ensurePathEntity(viewer, pathRef.current, positionsRef);
    centerOnPoint(viewer, telemetry);
    viewer.scene.requestRender();
  }, [viewer, telemetry, selectedDrone]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedDrone || !droneRef.current) {
      return;
    }

    if (initialCenteringRef.current) {
      viewer.trackedEntity = undefined;
      viewer.scene.requestRender();
      return;
    }

    viewer.trackedEntity = freeMode ? undefined : droneRef.current;
    viewer.scene.requestRender();
  }, [viewer, selectedDrone, freeMode]);

  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) {
        return;
      }

      resetSceneEntities(viewer);
    };
  }, [viewer]);

  return null;
}
