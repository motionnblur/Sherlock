import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { FLIGHT_PATH_POINT_LIMIT } from '../constants/telemetry';
import { NAVIGATION_DIRECTION_ALL } from '../constants/navigation';
import { PERFORMANCE_STAGE_NORMAL } from '../constants/performance';
import type { MapComponentProps } from '../interfaces/components';
import type { DroneId, TelemetryPoint } from '../interfaces/telemetry';
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
  onSelectDrone,
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
      fleetPointCollectionRef.current = null;
      fleetBillboardCollectionRef.current = null;
      fleetPolylineCollectionRef.current = null;
      fleetLabelCollectionRef.current = null;
      fleetAssetMapRef.current.clear();
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
          viewer.trackedEntity = freeMode ? undefined : entity;
          viewer.scene.requestRender();
        });
      }
      return;
    }

    viewer.trackedEntity = freeMode ? undefined : entity;
    viewer.scene.requestRender();
  }, [freeMode, showAllAssets, selectedDisplayTelemetry, selectedDrone, selectedLiveTelemetry, viewer]);

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
