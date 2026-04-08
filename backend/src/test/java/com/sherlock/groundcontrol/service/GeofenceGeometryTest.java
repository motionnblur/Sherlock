package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.GeofencePointDTO;
import org.junit.jupiter.api.Test;

import java.util.List;

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
