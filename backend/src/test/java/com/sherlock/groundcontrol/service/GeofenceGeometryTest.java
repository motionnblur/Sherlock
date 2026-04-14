package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.GeofencePointDTO;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeofenceGeometryTest {

    @Test
    void containsPointReturnsTrueForInteriorPoint() {
        List<GeofencePointDTO> polygon = squarePolygon();

        assertTrue(GeofenceGeometry.containsPoint(polygon, 37.25, 23.25));
    }

    @Test
    void containsPointReturnsFalseForExteriorPoint() {
        List<GeofencePointDTO> polygon = squarePolygon();

        assertFalse(GeofenceGeometry.containsPoint(polygon, 38.5, 24.0));
    }

    @Test
    void containsPointTreatsBorderAsInside() {
        List<GeofencePointDTO> polygon = squarePolygon();

        assertTrue(GeofenceGeometry.containsPoint(polygon, 37.0, 23.25));
    }

    @Test
    void validatePolygonRejectsSelfIntersectingShape() {
        List<GeofencePointDTO> bowTie = List.of(
                point(0, 37.0, 23.0),
                point(1, 38.0, 24.0),
                point(2, 37.0, 24.0),
                point(3, 38.0, 23.0)
        );

        assertThrows(IllegalArgumentException.class, () -> GeofenceGeometry.validatePolygon(bowTie));
    }

    @Test
    void containsPointReturnsFalseWhenPolygonHasTooFewPoints() {
        List<GeofencePointDTO> segment = List.of(
                point(0, 37.0, 23.0),
                point(1, 38.0, 24.0)
        );

        assertFalse(GeofenceGeometry.containsPoint(segment, 37.5, 23.5));
    }

    @Test
    void validatePolygonRejectsWhenFewerThanThreePointsProvided() {
        List<GeofencePointDTO> invalid = List.of(
                point(0, 37.0, 23.0),
                point(1, 38.0, 24.0)
        );

        assertThrows(IllegalArgumentException.class, () -> GeofenceGeometry.validatePolygon(invalid));
    }

    @Test
    void validatePolygonRejectsSelfIntersectionAfterAreaCheck() {
        List<GeofencePointDTO> selfIntersecting = List.of(
                point(0, 0.0, 0.0),
                point(1, 3.0, 2.0),
                point(2, 0.0, 4.0),
                point(3, 2.0, 0.0),
                point(4, 2.0, 4.0)
        );

        IllegalArgumentException exception =
                assertThrows(IllegalArgumentException.class, () -> GeofenceGeometry.validatePolygon(selfIntersecting));
        assertEquals("Geofence polygon must not self-intersect", exception.getMessage());
    }

    @Test
    void interpolationFallsBackToCurrentLongitudeForNearlyHorizontalEdge() throws Exception {
        Method interpolation = GeofenceGeometry.class.getDeclaredMethod(
                "interpolation",
                GeofencePointDTO.class,
                GeofencePointDTO.class,
                double.class
        );
        interpolation.setAccessible(true);

        GeofencePointDTO current = point(0, 1.0e-13, 10.0);
        GeofencePointDTO previous = point(1, 0.0, 20.0);

        double value = (double) interpolation.invoke(null, current, previous, 5.0e-14);

        assertEquals(10.0, value, 0.0);
    }

    private static List<GeofencePointDTO> squarePolygon() {
        return List.of(
                point(0, 37.0, 23.0),
                point(1, 37.0, 24.0),
                point(2, 38.0, 24.0),
                point(3, 38.0, 23.0)
        );
    }

    private static GeofencePointDTO point(int sequence, double latitude, double longitude) {
        return GeofencePointDTO.builder()
                .sequence(sequence)
                .latitude(latitude)
                .longitude(longitude)
                .build();
    }
}
