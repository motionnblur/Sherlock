import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import type { DroneProps } from '../interfaces/components';
import type { TelemetryPoint } from '../interfaces/telemetry';

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

function addStaticDroneEntity(viewer: Cesium.Viewer, position: Cesium.Cartesian3): Cesium.Entity {
  return viewer.entities.add({
    name: 'SHERLOCK-01',
    position,
    billboard: {
      image: DRONE_ICON,
      scale: 0.9,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      heightReference: Cesium.HeightReference.NONE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      color: Cesium.Color.fromCssColorString('#00FF41').withAlpha(0.45),
    },
    label: {
      text: '◆ SHERLOCK-01',
      font: '11px "JetBrains Mono", monospace',
      fillColor: Cesium.Color.fromCssColorString('#3d4f63'),
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

function addLiveDroneEntity(viewer: Cesium.Viewer, position: Cesium.Cartesian3): Cesium.Entity {
  return viewer.entities.add({
    name: 'SHERLOCK-01',
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
      text: '◆ SHERLOCK-01',
      font: '11px "JetBrains Mono", monospace',
      fillColor: Cesium.Color.fromCssColorString('#00FF41'),
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
  const initialFlown = useRef(false);
  const initialCentering = useRef(false);
  const freeModeRef = useRef(freeMode);

  useEffect(() => {
    freeModeRef.current = freeMode;
  }, [freeMode]);

  const ensureLiveTrackingEntities = (
    mapViewer: Cesium.Viewer,
    position: Cesium.Cartesian3,
  ): void => {
    if (!droneRef.current) {
      droneRef.current = addLiveDroneEntity(mapViewer, position);
    } else {
      droneRef.current.position = new Cesium.ConstantPositionProperty(position);
    }

    if (!pathRef.current) {
      pathRef.current = mapViewer.entities.add({
        name: 'flight-path',
        polyline: {
          positions: new Cesium.CallbackProperty(() => [...positionsRef.current], false),
          width: 1.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.15,
            color: Cesium.Color.fromCssColorString('#00FF41').withAlpha(0.65),
          }),
          clampToGround: false,
          arcType: Cesium.ArcType.NONE,
        },
      });
    }
  };

  const beginInitialCenter = (
    mapViewer: Cesium.Viewer,
    longitude: number,
    latitude: number,
  ): void => {
    if (initialFlown.current || initialCentering.current) return;

    initialCentering.current = true;
    mapViewer.trackedEntity = undefined;

    flyToAsset(mapViewer, longitude, latitude, () => {
      if (mapViewer.isDestroyed()) return;

      initialCentering.current = false;
      initialFlown.current = true;

      if (!freeModeRef.current && droneRef.current) {
        mapViewer.trackedEntity = droneRef.current;
      }

      mapViewer.scene.requestRender();
    });
  };

  useEffect(() => {
    if (selectedDrone) return;

    let cancelled = false;

    const loadLastKnown = async () => {
      try {
        const response = await fetch('/api/telemetry/history');
        const data = (await response.json()) as unknown;
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          onLastKnownChange(data[data.length - 1] as TelemetryPoint);
        }
      } catch {
        // no-op: map can still render without last known point
      }
    };

    loadLastKnown();

    return () => {
      cancelled = true;
    };
  }, [selectedDrone, onLastKnownChange]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    viewer.camera.cancelFlight();
    viewer.trackedEntity = undefined;

    if (droneRef.current) {
      viewer.entities.remove(droneRef.current);
      droneRef.current = null;
    }

    if (pathRef.current) {
      viewer.entities.remove(pathRef.current);
      pathRef.current = null;
    }

    positionsRef.current = [];
    initialFlown.current = false;
    initialCentering.current = false;
    viewer.scene.requestRender();
  }, [viewer, selectedDrone]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || selectedDrone || !lastKnown) return;

    viewer.trackedEntity = undefined;

    if (droneRef.current) {
      viewer.entities.remove(droneRef.current);
      droneRef.current = null;
    }

    const position = toCartesian(lastKnown);
    droneRef.current = addStaticDroneEntity(viewer, position);

    if (!initialFlown.current) {
      beginInitialCenter(viewer, lastKnown.longitude, lastKnown.latitude);
    }

    viewer.scene.requestRender();
  }, [viewer, selectedDrone, lastKnown]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedDrone || !lastKnown) return;

    const position = toCartesian(lastKnown);
    if (positionsRef.current.length === 0) {
      positionsRef.current.push(position);
    }

    ensureLiveTrackingEntities(viewer, position);

    if (!initialFlown.current) {
      beginInitialCenter(viewer, lastKnown.longitude, lastKnown.latitude);
    }

    viewer.scene.requestRender();
  }, [viewer, selectedDrone, lastKnown, freeMode]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !telemetry || !selectedDrone) return;

    const position = toCartesian(telemetry);
    positionsRef.current.push(position);
    if (positionsRef.current.length > 200) {
      positionsRef.current.shift();
    }

    ensureLiveTrackingEntities(viewer, position);

    if (!initialFlown.current) {
      beginInitialCenter(viewer, telemetry.longitude, telemetry.latitude);
    }

    viewer.scene.requestRender();
  }, [viewer, telemetry, selectedDrone, freeMode]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedDrone || !droneRef.current) return;

    if (initialCentering.current) {
      viewer.trackedEntity = undefined;
      viewer.scene.requestRender();
      return;
    }

    viewer.trackedEntity = freeMode ? undefined : droneRef.current;
    viewer.scene.requestRender();
  }, [viewer, selectedDrone, freeMode]);

  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) return;

      viewer.trackedEntity = undefined;

      if (droneRef.current) {
        viewer.entities.remove(droneRef.current);
        droneRef.current = null;
      }

      if (pathRef.current) {
        viewer.entities.remove(pathRef.current);
        pathRef.current = null;
      }
    };
  }, [viewer]);

  return null;
}
