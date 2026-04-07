import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  DRIVER_CAMERA_HEIGHT_OFFSET_METERS,
  DRIVER_CAMERA_TOPDOWN_PITCH_DEGREES,
} from '../constants/driver';
import { FLIGHT_PATH_POINT_LIMIT } from '../constants/telemetry';
import { NAVIGATION_DIRECTION_ALL } from '../constants/navigation';
import { PERFORMANCE_STAGE_NORMAL } from '../constants/performance';
import type { MapComponentProps } from '../interfaces/components';
import type { MissionWaypoint } from '../interfaces/mission';
import type { DriverWaypoint, DroneId, TelemetryPoint } from '../interfaces/telemetry';
import { formatFixed } from '../utils/formatters';
import { matchesNavigationDirection } from '../utils/navigation';
import FreeModeAssetWindow from './FreeModeAssetWindow';
import {
  applyImageryBrightness,
  applyPerformanceProfile,
  createViewer,
  ensureBuildings,
  ensureFleetCollections,
  ensurePathEntity,
  ensureSelectedDroneEntity,
  FleetAssetPrimitives,
  flyToAsset,
  HAS_TOKEN,
  MAP_BRIGHTNESS,
  MAP_DARKEN_PERCENT,
  removeBuildings,
  resetSelectedEntities,
  toCartesian,
  upsertFleetAsset,
} from './map/cesiumScene';

interface CameraControllerState {
  enableRotate: boolean;
  enableTranslate: boolean;
  enableZoom: boolean;
  enableTilt: boolean;
  enableLook: boolean;
}

function MapFrameOverlay({ isMapDimmed }: { isMapDimmed: boolean }) {
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

function SelectedTelemetryBanner({ telemetry }: { telemetry: TelemetryPoint }) {
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

export default function MapComponent({
  droneIds,
  telemetry,
  fleetTelemetry,
  lastKnownTelemetry,
  performanceStage,
  selectedDrone,
  freeMode,
  showAllAssets,
  selectedNavigationDirection,
  isDriverModeEnabled,
  driverWaypoints,
  onAddDriverWaypoint,
  onSelectDrone,
  isMissionModeEnabled,
  missionWaypoints,
  onAddMissionWaypoint,
}: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const buildingsRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const performanceStageRef = useRef(performanceStage);
  const selectedDroneRef = useRef<Cesium.Entity | null>(null);
  const selectedPathRef = useRef<Cesium.Entity | null>(null);
  const pathPositionsRef = useRef<Cesium.Cartesian3[]>([]);
  const initialFlyDoneRef = useRef(false);
  const initialCenteringRef = useRef(false);
  const lastPathTimestampRef = useRef<string | null>(null);
  const fleetPointCollectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const fleetBillboardCollectionRef = useRef<Cesium.BillboardCollection | null>(null);
  const fleetPolylineCollectionRef = useRef<Cesium.PolylineCollection | null>(null);
  const fleetLabelCollectionRef = useRef<Cesium.LabelCollection | null>(null);
  const fleetAssetMapRef = useRef<Map<DroneId, FleetAssetPrimitives>>(new Map());
  const driverRouteRef = useRef<Cesium.Entity | null>(null);
  const driverWaypointEntitiesRef = useRef<Cesium.Entity[]>([]);
  const missionRouteRef = useRef<Cesium.Entity | null>(null);
  const missionWaypointEntitiesRef = useRef<Cesium.Entity[]>([]);
  const cameraControllerStateRef = useRef<CameraControllerState | null>(null);

  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [isMapDimmed, setIsMapDimmed] = useState(false);

  const selectedLiveTelemetry = selectedDrone && telemetry?.droneId === selectedDrone ? telemetry : null;
  const selectedDisplayTelemetry = selectedDrone
    ? (selectedLiveTelemetry ?? fleetTelemetry[selectedDrone] ?? lastKnownTelemetry[selectedDrone] ?? null)
    : null;

  useEffect(() => {
    performanceStageRef.current = performanceStage;
  }, [performanceStage]);

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
      if (fleetPointCollectionRef.current) {
        viewerRef.current.scene.primitives.remove(fleetPointCollectionRef.current);
      }
      if (fleetBillboardCollectionRef.current) {
        viewerRef.current.scene.primitives.remove(fleetBillboardCollectionRef.current);
      }
      if (fleetPolylineCollectionRef.current) {
        viewerRef.current.scene.primitives.remove(fleetPolylineCollectionRef.current);
      }
      if (fleetLabelCollectionRef.current) {
        viewerRef.current.scene.primitives.remove(fleetLabelCollectionRef.current);
      }
      if (driverRouteRef.current) {
        viewerRef.current.entities.remove(driverRouteRef.current);
      }
      for (const entity of driverWaypointEntitiesRef.current) {
        viewerRef.current.entities.remove(entity);
      }
      if (missionRouteRef.current) {
        viewerRef.current.entities.remove(missionRouteRef.current);
      }
      for (const entity of missionWaypointEntitiesRef.current) {
        viewerRef.current.entities.remove(entity);
      }
      fleetPointCollectionRef.current = null;
      fleetBillboardCollectionRef.current = null;
      fleetPolylineCollectionRef.current = null;
      fleetLabelCollectionRef.current = null;
      fleetAssetMapRef.current.clear();
      driverRouteRef.current = null;
      driverWaypointEntitiesRef.current = [];
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

    applyPerformanceProfile(viewer, performanceStage);
    if (performanceStage !== PERFORMANCE_STAGE_NORMAL) {
      removeBuildings(viewer, buildingsRef);
      return;
    }
    void ensureBuildings(
      viewer,
      buildingsRef,
      () => performanceStageRef.current === PERFORMANCE_STAGE_NORMAL,
    );
  }, [viewer, performanceStage]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    resetSelectedEntities(viewer, selectedDroneRef, selectedPathRef, pathPositionsRef);
    clearDriverRouteEntities(viewer, driverRouteRef, driverWaypointEntitiesRef);
    initialFlyDoneRef.current = false;
    initialCenteringRef.current = false;
    lastPathTimestampRef.current = null;
  }, [viewer, selectedDrone]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedDrone || !selectedDisplayTelemetry) {
      return;
    }

    if (freeMode && showAllAssets) {
      // In SHOW ALL mode every drone is a uniform fleet asset — hide the selected entity.
      if (selectedDroneRef.current) {
        selectedDroneRef.current.show = false;
      }
      if (selectedPathRef.current) {
        selectedPathRef.current.show = false;
      }
      return;
    }

    if (selectedDroneRef.current) {
      selectedDroneRef.current.show = true;
    }
    if (selectedPathRef.current) {
      selectedPathRef.current.show = true;
    }

    const position = toCartesian(selectedDisplayTelemetry);
    const entity = ensureSelectedDroneEntity(viewer, selectedDrone, position, selectedDroneRef);
    const isLiveTick = selectedLiveTelemetry?.timestamp !== undefined
      && selectedLiveTelemetry.timestamp !== lastPathTimestampRef.current;

    if (isLiveTick && selectedLiveTelemetry) {
      pathPositionsRef.current.push(position);
      if (pathPositionsRef.current.length > FLIGHT_PATH_POINT_LIMIT) {
        pathPositionsRef.current.shift();
      }
      ensurePathEntity(viewer, selectedDrone, selectedPathRef, pathPositionsRef);
      lastPathTimestampRef.current = selectedLiveTelemetry.timestamp;
    }

    if (!initialFlyDoneRef.current) {
      if (!initialCenteringRef.current) {
        initialCenteringRef.current = true;
        viewer.trackedEntity = undefined;
        flyToAsset(viewer, selectedDisplayTelemetry, () => {
          if (viewer.isDestroyed()) {
            return;
          }
          initialCenteringRef.current = false;
          initialFlyDoneRef.current = true;
          viewer.trackedEntity = freeMode || isDriverModeEnabled ? undefined : entity;
          viewer.scene.requestRender();
        });
      }
      return;
    }

    viewer.trackedEntity = freeMode || isDriverModeEnabled ? undefined : entity;
    viewer.scene.requestRender();
  }, [freeMode, isDriverModeEnabled, showAllAssets, selectedDisplayTelemetry, selectedDrone, selectedLiveTelemetry, viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      return;
    }
    const cameraController = viewer.scene.screenSpaceCameraController;
    const shouldLockCamera = isDriverModeEnabled && !freeMode && Boolean(selectedDrone);

    if (shouldLockCamera) {
      if (!cameraControllerStateRef.current) {
        cameraControllerStateRef.current = {
          enableRotate: cameraController.enableRotate,
          enableTranslate: cameraController.enableTranslate,
          enableZoom: cameraController.enableZoom,
          enableTilt: cameraController.enableTilt,
          enableLook: cameraController.enableLook,
        };
      }
      cameraController.enableRotate = false;
      cameraController.enableTranslate = false;
      cameraController.enableZoom = false;
      cameraController.enableTilt = false;
      cameraController.enableLook = false;
      viewer.trackedEntity = undefined;
      viewer.scene.requestRender();
      return;
    }

    if (!cameraControllerStateRef.current) {
      return;
    }

    cameraController.enableRotate = cameraControllerStateRef.current.enableRotate;
    cameraController.enableTranslate = cameraControllerStateRef.current.enableTranslate;
    cameraController.enableZoom = cameraControllerStateRef.current.enableZoom;
    cameraController.enableTilt = cameraControllerStateRef.current.enableTilt;
    cameraController.enableLook = cameraControllerStateRef.current.enableLook;
    cameraControllerStateRef.current = null;
    viewer.scene.requestRender();
  }, [freeMode, isDriverModeEnabled, selectedDrone, viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedDisplayTelemetry) {
      return;
    }
    if (!isDriverModeEnabled || freeMode || !selectedDrone) {
      return;
    }

    const lockedCameraAltitude = selectedDisplayTelemetry.altitude + DRIVER_CAMERA_HEIGHT_OFFSET_METERS;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        selectedDisplayTelemetry.longitude,
        selectedDisplayTelemetry.latitude,
        lockedCameraAltitude,
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(DRIVER_CAMERA_TOPDOWN_PITCH_DEGREES),
        roll: 0,
      },
    });
    viewer.scene.requestRender();
  }, [freeMode, isDriverModeEnabled, selectedDisplayTelemetry, selectedDrone, viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      return;
    }
    clearDriverRouteEntities(viewer, driverRouteRef, driverWaypointEntitiesRef);
    if (!selectedDrone || freeMode || driverWaypoints.length === 0) {
      viewer.scene.requestRender();
      return;
    }

    const routePositions = driverWaypoints.map((waypoint) =>
      Cesium.Cartesian3.fromDegrees(waypoint.longitude, waypoint.latitude, waypoint.altitude),
    );

    driverRouteRef.current = viewer.entities.add({
      name: `driver-route-${selectedDrone}`,
      polyline: {
        positions: routePositions,
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.fromCssColorString('#00FF41').withAlpha(0.9),
        }),
        clampToGround: false,
        arcType: Cesium.ArcType.NONE,
      },
    });

    driverWaypointEntitiesRef.current = driverWaypoints.map((waypoint, waypointIndex) =>
      viewer.entities.add({
        name: `driver-waypoint-${waypoint.id}`,
        position: Cesium.Cartesian3.fromDegrees(waypoint.longitude, waypoint.latitude, waypoint.altitude),
        point: {
          pixelSize: waypoint.status === 'active' ? 8 : 6,
          color: waypointColor(waypoint.status),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${waypointIndex + 1}`,
          font: '11px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString('#00FF41'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }),
    );

    viewer.scene.requestRender();
  }, [driverWaypoints, freeMode, selectedDrone, viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      return;
    }
    clearMissionRouteEntities(viewer, missionRouteRef, missionWaypointEntitiesRef);
    if (!selectedDrone || freeMode || missionWaypoints.length === 0) {
      viewer.scene.requestRender();
      return;
    }

    const routePositions = missionWaypoints.map((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude),
    );

    missionRouteRef.current = viewer.entities.add({
      name: `mission-route-${selectedDrone}`,
      polyline: {
        positions: routePositions,
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.fromCssColorString('#FFB400').withAlpha(0.9),
        }),
        clampToGround: false,
        arcType: Cesium.ArcType.NONE,
      },
    });

    missionWaypointEntitiesRef.current = missionWaypoints.map((wp, index) =>
      viewer.entities.add({
        name: `mission-waypoint-${wp.id ?? index}`,
        position: Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude),
        point: {
          pixelSize: wp.status === 'ACTIVE' ? 9 : 6,
          color: missionWaypointColor(wp.status),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${index + 1}`,
          font: '11px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString('#FFB400'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }),
    );

    viewer.scene.requestRender();
  }, [missionWaypoints, freeMode, selectedDrone, viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    const onLeftClick = (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (isMissionModeEnabled && !freeMode && selectedDrone) {
        const worldPosition = pickWorldPosition(viewer, movement.position);
        if (!worldPosition) return;
        const cartographic = Cesium.Cartographic.fromCartesian(worldPosition);
        onAddMissionWaypoint(
          Cesium.Math.toDegrees(cartographic.latitude),
          Cesium.Math.toDegrees(cartographic.longitude),
        );
        viewer.scene.requestRender();
        return;
      }
      if (!isDriverModeEnabled || freeMode || !selectedDrone) {
        return;
      }
      const pickedPosition = pickDriverWaypointPosition(
        viewer,
        movement.position,
        selectedDisplayTelemetry?.latitude ?? null,
        selectedDisplayTelemetry?.longitude ?? null,
        selectedDisplayTelemetry?.altitude ?? null,
      );
      if (!pickedPosition) {
        return;
      }
      const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
      onAddDriverWaypoint(
        Cesium.Math.toDegrees(cartographic.latitude),
        Cesium.Math.toDegrees(cartographic.longitude),
      );
      viewer.scene.requestRender();
    };

    viewer.screenSpaceEventHandler.setInputAction(onLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return () => {
      viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };
  }, [freeMode, isDriverModeEnabled, isMissionModeEnabled, onAddDriverWaypoint, onAddMissionWaypoint, selectedDisplayTelemetry, selectedDrone, viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    const { pointCollection, billboardCollection, polylineCollection, labelCollection } = ensureFleetCollections(viewer, fleetPointCollectionRef, fleetBillboardCollectionRef, fleetPolylineCollectionRef, fleetLabelCollectionRef);
    const shouldRenderFleet = !selectedDrone || (freeMode && showAllAssets);
    if (!shouldRenderFleet) {
      pointCollection.removeAll();
      billboardCollection.removeAll();
      polylineCollection.removeAll();
      labelCollection.removeAll();
      fleetAssetMapRef.current.clear();
      viewer.scene.requestRender();
      return;
    }

    const visibleIds = new Set<DroneId>();
    const isShowAll = freeMode && showAllAssets;
    const shouldFilterByDirection = isShowAll && selectedNavigationDirection !== NAVIGATION_DIRECTION_ALL;
    for (const droneId of droneIds) {
      if (!isShowAll && selectedDrone && droneId === selectedDrone) {
        continue;
      }
      const telemetryPoint = fleetTelemetry[droneId] ?? lastKnownTelemetry[droneId];
      if (!telemetryPoint) {
        continue;
      }
      if (shouldFilterByDirection && !matchesNavigationDirection(telemetryPoint.heading, selectedNavigationDirection)) {
        continue;
      }
      upsertFleetAsset(pointCollection, billboardCollection, polylineCollection, labelCollection, fleetAssetMapRef, droneId, telemetryPoint);
      visibleIds.add(droneId);
    }

    for (const [droneId, primitives] of fleetAssetMapRef.current.entries()) {
      if (visibleIds.has(droneId)) {
        continue;
      }
      pointCollection.remove(primitives.point);
      billboardCollection.remove(primitives.billboard);
      polylineCollection.remove(primitives.polyline);
      labelCollection.remove(primitives.label);
      fleetAssetMapRef.current.delete(droneId);
    }

    viewer.scene.requestRender();
  }, [droneIds, fleetTelemetry, freeMode, lastKnownTelemetry, selectedDrone, selectedNavigationDirection, showAllAssets, viewer]);

  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) {
        return;
      }
      resetSelectedEntities(viewer, selectedDroneRef, selectedPathRef, pathPositionsRef);
      clearDriverRouteEntities(viewer, driverRouteRef, driverWaypointEntitiesRef);
      clearMissionRouteEntities(viewer, missionRouteRef, missionWaypointEntitiesRef);
    };
  }, [viewer]);

  return (
    <div className="relative w-full h-full bg-surface">
      <div ref={containerRef} className="w-full h-full" />

      <MapFrameOverlay isMapDimmed={isMapDimmed} />

      {freeMode && !showAllAssets && (
        <FreeModeAssetWindow droneIds={droneIds} selectedDrone={selectedDrone} onActivateDrone={onSelectDrone} />
      )}

      {selectedLiveTelemetry && selectedDrone && !freeMode && (
        <SelectedTelemetryBanner telemetry={selectedLiveTelemetry} />
      )}


    </div>
  );
}

function clearDriverRouteEntities(
  viewer: Cesium.Viewer,
  driverRouteRef: MutableRefObject<Cesium.Entity | null>,
  driverWaypointEntitiesRef: MutableRefObject<Cesium.Entity[]>,
) {
  if (driverRouteRef.current) {
    viewer.entities.remove(driverRouteRef.current);
    driverRouteRef.current = null;
  }
  for (const waypointEntity of driverWaypointEntitiesRef.current) {
    viewer.entities.remove(waypointEntity);
  }
  driverWaypointEntitiesRef.current = [];
}

function clearMissionRouteEntities(
  viewer: Cesium.Viewer,
  missionRouteRef: MutableRefObject<Cesium.Entity | null>,
  missionWaypointEntitiesRef: MutableRefObject<Cesium.Entity[]>,
) {
  if (missionRouteRef.current) {
    viewer.entities.remove(missionRouteRef.current);
    missionRouteRef.current = null;
  }
  for (const entity of missionWaypointEntitiesRef.current) {
    viewer.entities.remove(entity);
  }
  missionWaypointEntitiesRef.current = [];
}

function missionWaypointColor(status: MissionWaypoint['status']): Cesium.Color {
  switch (status) {
    case 'ACTIVE':  return Cesium.Color.fromCssColorString('#FFB400');
    case 'REACHED': return Cesium.Color.fromCssColorString('#00FF41');
    case 'SKIPPED': return Cesium.Color.fromCssColorString('#3d4f63');
    default:        return Cesium.Color.fromCssColorString('#FFB400').withAlpha(0.5);
  }
}

function waypointColor(status: DriverWaypoint['status']): Cesium.Color {
  switch (status) {
    case 'active':
      return Cesium.Color.fromCssColorString('#FFB400');
    case 'reached':
      return Cesium.Color.fromCssColorString('#00FF41');
    case 'failed':
      return Cesium.Color.fromCssColorString('#FF3B30');
    default:
      return Cesium.Color.fromCssColorString('#00FF41').withAlpha(0.7);
  }
}

function pickWorldPosition(
  viewer: Cesium.Viewer,
  screenPosition: Cesium.Cartesian2,
): Cesium.Cartesian3 | undefined {
  const pickRay = viewer.camera.getPickRay(screenPosition);
  if (pickRay) {
    const terrainHit = viewer.scene.globe.pick(pickRay, viewer.scene);
    if (terrainHit) {
      return terrainHit;
    }
  }

  if (viewer.scene.pickPositionSupported) {
    const depthHit = viewer.scene.pickPosition(screenPosition);
    if (depthHit) {
      return depthHit;
    }
  }

  return viewer.camera.pickEllipsoid(screenPosition, viewer.scene.globe.ellipsoid) ?? undefined;
}

function pickDriverWaypointPosition(
  viewer: Cesium.Viewer,
  screenPosition: Cesium.Cartesian2,
  referenceLatitude: number | null,
  referenceLongitude: number | null,
  referenceAltitude: number | null,
): Cesium.Cartesian3 | undefined {
  if (referenceLatitude !== null && referenceLongitude !== null && referenceAltitude !== null) {
    const pickRay = viewer.camera.getPickRay(screenPosition);
    if (pickRay) {
      const planeReferencePoint = Cesium.Cartesian3.fromDegrees(
        referenceLongitude,
        referenceLatitude,
        referenceAltitude,
      );
      const planeNormal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
        planeReferencePoint,
        new Cesium.Cartesian3(),
      );
      const altitudePlane = Cesium.Plane.fromPointNormal(planeReferencePoint, planeNormal);
      const planeHit = Cesium.IntersectionTests.rayPlane(pickRay, altitudePlane);
      if (planeHit) {
        return planeHit;
      }
    }
  }

  return pickWorldPosition(viewer, screenPosition);
}
