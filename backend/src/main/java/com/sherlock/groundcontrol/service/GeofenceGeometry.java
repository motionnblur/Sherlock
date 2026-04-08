package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.GeofencePointDTO;

import java.util.List;

final class GeofenceGeometry {

    private static final double AREA_EPSILON = 1.0e-12;

    private GeofenceGeometry() {
    }

    static void validatePolygon(List<GeofencePointDTO> points) {
        if (points.size() < 3) {
            throw new IllegalArgumentException("Geofence must contain at least 3 points");
        }

        double twiceArea = signedArea(points);
        if (Math.abs(twiceArea) < AREA_EPSILON) {
            throw new IllegalArgumentException("Geofence polygon must enclose a non-zero area");
        }

        if (hasSelfIntersection(points)) {
            throw new IllegalArgumentException("Geofence polygon must not self-intersect");
        }
    }

    static boolean containsPoint(List<GeofencePointDTO> points, double latitude, double longitude) {
        if (points.size() < 3) {
            return false;
        }

        boolean inside = false;
        int lastIndex = points.size() - 1;

        for (int index = 0; index < points.size(); index += 1) {
            GeofencePointDTO current = points.get(index);
            GeofencePointDTO previous = points.get(lastIndex);

            if (isPointOnSegment(longitude, latitude,
                    previous.getLongitude(), previous.getLatitude(),
                    current.getLongitude(), current.getLatitude())) {
                return true;
            }

            boolean crossesRay = ((current.getLatitude() > latitude) != (previous.getLatitude() > latitude))
                    && (longitude < interpolation(current, previous, latitude));
            if (crossesRay) {
                inside = !inside;
            }

            lastIndex = index;
        }

        return inside;
    }

    private static double signedArea(List<GeofencePointDTO> points) {
        double area = 0.0;
        for (int index = 0; index < points.size(); index += 1) {
            GeofencePointDTO current = points.get(index);
            GeofencePointDTO next = points.get((index + 1) % points.size());
            area += current.getLongitude() * next.getLatitude();
            area -= next.getLongitude() * current.getLatitude();
        }
        return area;
    }

    private static boolean hasSelfIntersection(List<GeofencePointDTO> points) {
        for (int first = 0; first < points.size(); first += 1) {
            int firstNext = (first + 1) % points.size();
            for (int second = first + 1; second < points.size(); second += 1) {
                int secondNext = (second + 1) % points.size();
                if (sharesVertex(first, firstNext, second, secondNext)) {
                    continue;
                }
                if (segmentsIntersect(
                        points.get(first).getLongitude(), points.get(first).getLatitude(),
                        points.get(firstNext).getLongitude(), points.get(firstNext).getLatitude(),
                        points.get(second).getLongitude(), points.get(second).getLatitude(),
                        points.get(secondNext).getLongitude(), points.get(secondNext).getLatitude()
                )) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean sharesVertex(int first, int firstNext, int second, int secondNext) {
        return first == second
                || first == secondNext
                || firstNext == second
                || first == firstNext
                || second == secondNext;
    }

    private static boolean segmentsIntersect(
            double ax, double ay,
            double bx, double by,
            double cx, double cy,
            double dx, double dy
    ) {
        double o1 = orientation(ax, ay, bx, by, cx, cy);
        double o2 = orientation(ax, ay, bx, by, dx, dy);
        double o3 = orientation(cx, cy, dx, dy, ax, ay);
        double o4 = orientation(cx, cy, dx, dy, bx, by);

        if (o1 * o2 < 0 && o3 * o4 < 0) {
            return true;
        }

        return o1 == 0.0 && isPointOnSegment(cx, cy, ax, ay, bx, by)
                || o2 == 0.0 && isPointOnSegment(dx, dy, ax, ay, bx, by)
                || o3 == 0.0 && isPointOnSegment(ax, ay, cx, cy, dx, dy)
                || o4 == 0.0 && isPointOnSegment(bx, by, cx, cy, dx, dy);
    }

    private static double orientation(double ax, double ay, double bx, double by, double cx, double cy) {
        return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    }

    private static boolean isPointOnSegment(
            double px,
            double py,
            double ax,
            double ay,
            double bx,
            double by
    ) {
        double cross = orientation(ax, ay, bx, by, px, py);
        if (Math.abs(cross) > AREA_EPSILON) {
            return false;
        }
        return px >= Math.min(ax, bx) - AREA_EPSILON
                && px <= Math.max(ax, bx) + AREA_EPSILON
                && py >= Math.min(ay, by) - AREA_EPSILON
                && py <= Math.max(ay, by) + AREA_EPSILON;
    }

    private static double interpolation(GeofencePointDTO current, GeofencePointDTO previous, double latitude) {
        double deltaLatitude = previous.getLatitude() - current.getLatitude();
        if (Math.abs(deltaLatitude) < AREA_EPSILON) {
            return current.getLongitude();
        }
        return current.getLongitude()
                + (latitude - current.getLatitude())
                * (previous.getLongitude() - current.getLongitude())
                / deltaLatitude;
    }
}
