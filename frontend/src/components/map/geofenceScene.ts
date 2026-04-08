import type { MutableRefObject } from 'react';
import * as Cesium from 'cesium';
import type { Geofence, GeofencePointInput } from '../../interfaces/geofence';

const ACTIVE_FILL = Cesium.Color.fromCssColorString('#FFB400').withAlpha(0.12);
const ACTIVE_OUTLINE = Cesium.Color.fromCssColorString('#FFB400').withAlpha(0.9);
const ACTIVE_VERTEX = Cesium.Color.fromCssColorString('#FFB400');
const DRAFT_FILL = Cesium.Color.fromCssColorString('#00FF41').withAlpha(0.12);
const DRAFT_OUTLINE = Cesium.Color.fromCssColorString('#00FF41').withAlpha(0.9);
const DRAFT_VERTEX = Cesium.Color.fromCssColorString('#00FF41');
const LABEL_FONT = '10px "JetBrains Mono", monospace';

export interface GeofenceVisuals {
  fill: Cesium.Entity;
  outline: Cesium.Entity;
  vertices: Cesium.Entity[];
  label: Cesium.Entity;
}

export function renderActiveGeofences(
  viewer: Cesium.Viewer,
  geofences: Geofence[],
  geofenceVisualsRef: MutableRefObject<Map<number, GeofenceVisuals>>,
): void {
  clearGeofenceVisuals(viewer, geofenceVisualsRef);

  for (const geofence of geofences) {
    if (!geofence.isActive || geofence.points.length === 0) {
      continue;
    }

    const positions = toPositions(geofence.points);
    const closedPositions = [...positions, positions[0]];
    const centroid = toCentroid(geofence.points);

    const fill = viewer.entities.add({
      name: `geofence-fill-${geofence.id}`,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: ACTIVE_FILL,
        outline: false,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    const outline = viewer.entities.add({
      name: `geofence-outline-${geofence.id}`,
      polyline: {
        positions: closedPositions,
        width: 2,
        material: ACTIVE_OUTLINE,
        clampToGround: true,
        arcType: Cesium.ArcType.GEODESIC,
      },
    });
    const label = viewer.entities.add({
      name: `geofence-label-${geofence.id}`,
      position: Cesium.Cartesian3.fromDegrees(centroid.longitude, centroid.latitude, 0),
      label: {
        text: geofence.name,
        font: LABEL_FONT,
        fillColor: ACTIVE_OUTLINE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    const vertices = geofence.points.map((point, index) =>
      viewer.entities.add({
        name: `geofence-vertex-${geofence.id}-${index}`,
        position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 0),
        point: {
          pixelSize: 4,
          color: ACTIVE_VERTEX,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }),
    );

    geofenceVisualsRef.current.set(geofence.id, { fill, outline, vertices, label });
  }

  viewer.scene.requestRender();
}

export function renderDraftGeofence(
  viewer: Cesium.Viewer,
  points: GeofencePointInput[],
  draftVisualRef: MutableRefObject<GeofenceVisuals | null>,
): void {
  clearDraftGeofence(viewer, draftVisualRef);

  if (points.length === 0) {
    viewer.scene.requestRender();
    return;
  }

  const positions = toPositions(points);
  const closedPositions = points.length > 1 ? [...positions, positions[0]] : positions;
  const centroid = toCentroid(points);
  const hasPolygon = points.length >= 3;

  const fill = hasPolygon
    ? viewer.entities.add({
        name: 'geofence-draft-fill',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: DRAFT_FILL,
          outline: false,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })
    : viewer.entities.add({
        name: 'geofence-draft-fill',
        show: false,
      });
  const outline = viewer.entities.add({
    name: 'geofence-draft-outline',
    polyline: {
      positions: closedPositions,
      width: 2,
      material: DRAFT_OUTLINE,
      clampToGround: true,
      arcType: Cesium.ArcType.GEODESIC,
    },
  });
  const label = viewer.entities.add({
    name: 'geofence-draft-label',
    position: Cesium.Cartesian3.fromDegrees(centroid.longitude, centroid.latitude, 0),
    label: {
      text: 'DRAFT',
      font: LABEL_FONT,
      fillColor: DRAFT_OUTLINE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  const vertices = points.map((point, index) =>
    viewer.entities.add({
      name: `geofence-draft-vertex-${index}`,
      position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 0),
      point: {
        pixelSize: 5,
        color: DRAFT_VERTEX,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    }),
  );

  draftVisualRef.current = { fill, outline, vertices, label };
  viewer.scene.requestRender();
}

export function clearGeofenceVisuals(
  viewer: Cesium.Viewer,
  geofenceVisualsRef: MutableRefObject<Map<number, GeofenceVisuals>>,
): void {
  for (const visuals of geofenceVisualsRef.current.values()) {
    removeGeofenceVisual(viewer, visuals);
  }
  geofenceVisualsRef.current.clear();
}

export function clearDraftGeofence(
  viewer: Cesium.Viewer,
  draftVisualRef: MutableRefObject<GeofenceVisuals | null>,
): void {
  if (!draftVisualRef.current) {
    return;
  }
  removeGeofenceVisual(viewer, draftVisualRef.current);
  draftVisualRef.current = null;
}

function removeGeofenceVisual(viewer: Cesium.Viewer, visuals: GeofenceVisuals): void {
  viewer.entities.remove(visuals.fill);
  viewer.entities.remove(visuals.outline);
  viewer.entities.remove(visuals.label);
  for (const vertex of visuals.vertices) {
    viewer.entities.remove(vertex);
  }
}

function toPositions(points: GeofencePointInput[]): Cesium.Cartesian3[] {
  return points.map((point) => Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 0));
}

function toCentroid(points: GeofencePointInput[]): { latitude: number; longitude: number } {
  const total = points.reduce((accumulator, point) => ({
    latitude: accumulator.latitude + point.latitude,
    longitude: accumulator.longitude + point.longitude,
  }), { latitude: 0, longitude: 0 });

  return {
    latitude: total.latitude / points.length,
    longitude: total.longitude / points.length,
  };
}
