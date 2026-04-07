import * as Cesium from 'cesium';
import {
  MISSION_GIZMO_AXIS_LENGTH_METERS,
  MISSION_GIZMO_AXIS_LINE_WIDTH,
  MISSION_GIZMO_AXIS_TIP_SIZE,
} from '../../constants/mission';
import type { MissionGizmoAxis, MissionWaypointPosition } from '../../interfaces/mission';

const WAYPOINT_NAME_PREFIX = 'mission-waypoint-local-';
const GIZMO_NAME_PREFIX = 'mission-gizmo-axis-';
const GIZMO_AXIS_ALPHA = 0.95;

export interface AxisFrame {
  east: Cesium.Cartesian3;
  north: Cesium.Cartesian3;
  up: Cesium.Cartesian3;
}

export interface MissionGizmoDragState {
  axis: MissionGizmoAxis;
  waypointLocalId: number;
  dragPlane: Cesium.Plane;
  startScalarMeters: number;
  basePosition: Cesium.Cartesian3;
  baseAltitudeMeters: number;
  axisDirection: Cesium.Cartesian3;
}

export function toMissionWaypointEntityName(localId: number): string {
  return `${WAYPOINT_NAME_PREFIX}${localId}`;
}

export function tryParsePickedWaypointLocalId(pickedObject: unknown): number | null {
  const name = getPickedEntityName(pickedObject);
  if (!name.startsWith(WAYPOINT_NAME_PREFIX)) {
    return null;
  }
  const localId = Number.parseInt(name.slice(WAYPOINT_NAME_PREFIX.length), 10);
  return Number.isFinite(localId) ? localId : null;
}

export function tryParsePickedGizmoAxis(pickedObject: unknown): MissionGizmoAxis | null {
  const name = getPickedEntityName(pickedObject);
  const axisToken = name.replace(GIZMO_NAME_PREFIX, '');
  return axisToken === 'X' || axisToken === 'Y' || axisToken === 'Z' ? axisToken : null;
}

export function buildAxisFrame(origin: Cesium.Cartesian3): AxisFrame {
  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const east4 = Cesium.Matrix4.getColumn(transform, 0, new Cesium.Cartesian4());
  const north4 = Cesium.Matrix4.getColumn(transform, 1, new Cesium.Cartesian4());
  const up4 = Cesium.Matrix4.getColumn(transform, 2, new Cesium.Cartesian4());
  return {
    east: Cesium.Cartesian3.normalize(new Cesium.Cartesian3(east4.x, east4.y, east4.z), new Cesium.Cartesian3()),
    north: Cesium.Cartesian3.normalize(new Cesium.Cartesian3(north4.x, north4.y, north4.z), new Cesium.Cartesian3()),
    up: Cesium.Cartesian3.normalize(new Cesium.Cartesian3(up4.x, up4.y, up4.z), new Cesium.Cartesian3()),
  };
}

export function buildMissionGizmo(
  viewer: Cesium.Viewer,
  origin: Cesium.Cartesian3,
  frame: AxisFrame,
  axisLengthMeters: number = MISSION_GIZMO_AXIS_LENGTH_METERS,
): Cesium.Entity[] {
  const axes: MissionGizmoAxis[] = ['X', 'Y', 'Z'];
  return axes.flatMap((axis) => {
    const axisDirection = axisDirectionFor(frame, axis);
    const axisColor = axisColorFor(axis).withAlpha(GIZMO_AXIS_ALPHA);
    const axisEndpoint = Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.multiplyByScalar(
        axisDirection,
        axisLengthMeters,
        new Cesium.Cartesian3(),
      ),
      new Cesium.Cartesian3(),
    );

    const axisEntity = viewer.entities.add({
      name: `${GIZMO_NAME_PREFIX}${axis}`,
      polyline: {
        positions: [origin, axisEndpoint],
        width: MISSION_GIZMO_AXIS_LINE_WIDTH,
        material: axisColor,
        clampToGround: false,
        arcType: Cesium.ArcType.NONE,
      },
    });

    const tipEntity = viewer.entities.add({
      name: `${GIZMO_NAME_PREFIX}${axis}`,
      position: axisEndpoint,
      point: {
        pixelSize: MISSION_GIZMO_AXIS_TIP_SIZE,
        color: axisColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    return [axisEntity, tipEntity];
  });
}

export function buildDragState(
  viewer: Cesium.Viewer,
  axis: MissionGizmoAxis,
  waypointLocalId: number,
  waypoint: MissionWaypointPosition,
  screenPosition: Cesium.Cartesian2,
): MissionGizmoDragState | null {
  const basePosition = Cesium.Cartesian3.fromDegrees(waypoint.longitude, waypoint.latitude, waypoint.altitude);
  const frame = buildAxisFrame(basePosition);
  const axisDirection = axisDirectionFor(frame, axis);
  const dragPlane = buildAxisDragPlane(viewer, basePosition, axisDirection, frame);
  const startHit = pickRayPlaneIntersection(viewer, screenPosition, dragPlane);
  if (!startHit) {
    return null;
  }

  const startDelta = Cesium.Cartesian3.subtract(startHit, basePosition, new Cesium.Cartesian3());
  const startScalarMeters = Cesium.Cartesian3.dot(startDelta, axisDirection);

  return {
    axis,
    waypointLocalId,
    dragPlane,
    startScalarMeters,
    basePosition,
    baseAltitudeMeters: waypoint.altitude,
    axisDirection,
  };
}

export function computeDraggedWaypointPosition(
  viewer: Cesium.Viewer,
  dragState: MissionGizmoDragState,
  screenPosition: Cesium.Cartesian2,
): MissionWaypointPosition | null {
  const currentHit = pickRayPlaneIntersection(viewer, screenPosition, dragState.dragPlane);
  if (!currentHit) {
    return null;
  }

  const currentDelta = Cesium.Cartesian3.subtract(
    currentHit,
    dragState.basePosition,
    new Cesium.Cartesian3(),
  );
  const currentScalarMeters = Cesium.Cartesian3.dot(currentDelta, dragState.axisDirection);
  const movementMeters = currentScalarMeters - dragState.startScalarMeters;
  const movedPosition = Cesium.Cartesian3.add(
    dragState.basePosition,
    Cesium.Cartesian3.multiplyByScalar(dragState.axisDirection, movementMeters, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );
  const movedCartographic = Cesium.Cartographic.fromCartesian(movedPosition);
  if (!movedCartographic) {
    return null;
  }

  const altitudeMeters = dragState.axis === 'Z'
    ? movedCartographic.height
    : dragState.baseAltitudeMeters;

  return {
    latitude: Cesium.Math.toDegrees(movedCartographic.latitude),
    longitude: Cesium.Math.toDegrees(movedCartographic.longitude),
    altitude: altitudeMeters,
  };
}

function getPickedEntityName(pickedObject: unknown): string {
  const maybePicked = pickedObject as { id?: unknown } | undefined;
  const id = maybePicked?.id;
  if (!(id instanceof Cesium.Entity)) {
    return '';
  }
  return typeof id.name === 'string' ? id.name : '';
}

function axisDirectionFor(frame: AxisFrame, axis: MissionGizmoAxis): Cesium.Cartesian3 {
  if (axis === 'X') {
    return frame.east;
  }
  if (axis === 'Y') {
    return frame.north;
  }
  return frame.up;
}

function axisColorFor(axis: MissionGizmoAxis): Cesium.Color {
  if (axis === 'X') {
    return Cesium.Color.fromCssColorString('#FF3B30');
  }
  if (axis === 'Y') {
    return Cesium.Color.fromCssColorString('#00FF41');
  }
  return Cesium.Color.fromCssColorString('#3A86FF');
}

function buildAxisDragPlane(
  viewer: Cesium.Viewer,
  origin: Cesium.Cartesian3,
  axisDirection: Cesium.Cartesian3,
  frame: AxisFrame,
): Cesium.Plane {
  let planeNormal = Cesium.Cartesian3.cross(axisDirection, viewer.camera.directionWC, new Cesium.Cartesian3());
  if (Cesium.Cartesian3.magnitude(planeNormal) < 1e-6) {
    planeNormal = Cesium.Cartesian3.cross(axisDirection, frame.up, new Cesium.Cartesian3());
  }
  if (Cesium.Cartesian3.magnitude(planeNormal) < 1e-6) {
    planeNormal = Cesium.Cartesian3.cross(axisDirection, frame.east, new Cesium.Cartesian3());
  }
  const normalizedNormal = Cesium.Cartesian3.normalize(planeNormal, new Cesium.Cartesian3());
  return Cesium.Plane.fromPointNormal(origin, normalizedNormal);
}

function pickRayPlaneIntersection(
  viewer: Cesium.Viewer,
  screenPosition: Cesium.Cartesian2,
  plane: Cesium.Plane,
): Cesium.Cartesian3 | null {
  const ray = viewer.camera.getPickRay(screenPosition);
  if (!ray) {
    return null;
  }
  return Cesium.IntersectionTests.rayPlane(ray, plane);
}
