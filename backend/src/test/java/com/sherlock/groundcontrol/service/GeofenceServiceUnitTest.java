package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.GeofenceDTO;
import com.sherlock.groundcontrol.dto.GeofencePointDTO;
import com.sherlock.groundcontrol.dto.GeofenceRequestDTO;
import com.sherlock.groundcontrol.entity.GeofenceEntity;
import com.sherlock.groundcontrol.entity.GeofencePointEntity;
import com.sherlock.groundcontrol.exception.GeofenceConflictException;
import com.sherlock.groundcontrol.exception.GeofenceNotFoundException;
import com.sherlock.groundcontrol.exception.GeofenceValidationException;
import com.sherlock.groundcontrol.repository.GeofenceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GeofenceServiceUnitTest {

    @Mock
    private GeofenceRepository geofenceRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private GeofenceService geofenceService;

    @BeforeEach
    void setUp() {
        geofenceService = new GeofenceService(geofenceRepository, eventPublisher);

        lenient().when(geofenceRepository.save(any(GeofenceEntity.class))).thenAnswer(invocation -> {
            GeofenceEntity entity = invocation.getArgument(0);
            if (entity.getId() == null) {
                entity.setId(99L);
            }
            return entity;
        });
    }

    @Test
    void initializeCacheLoadsActiveSnapshot() {
        when(geofenceRepository.findAllByActiveTrueOrderByCreatedAtDesc())
                .thenReturn(List.of(entity(1L, "ACTIVE", true)));

        geofenceService.initializeCache();

        List<GeofenceDTO> snapshot = geofenceService.getActiveGeofencesSnapshot();
        assertEquals(1, snapshot.size());
        assertEquals("ACTIVE", snapshot.get(0).getName());
    }

    @Test
    void createGeofenceValidatesUniquenessAndPersistsPoints() {
        when(geofenceRepository.existsByNameIgnoreCase("RANGE-A")).thenReturn(false);
        when(geofenceRepository.findAllByActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of());

        GeofenceDTO created = geofenceService.createGeofence(request("RANGE-A", null, triangle()));

        assertEquals(99L, created.getId());
        assertEquals("RANGE-A", created.getName());
        assertTrue(created.isActive());
        assertEquals(3, created.getPoints().size());

        ArgumentCaptor<GeofenceEntity> captor = ArgumentCaptor.forClass(GeofenceEntity.class);
        verify(geofenceRepository).save(captor.capture());
        assertEquals(3, captor.getValue().getPoints().size());

        ArgumentCaptor<GeofenceTopologyChangedEvent> eventCaptor = ArgumentCaptor.forClass(GeofenceTopologyChangedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertEquals(99L, eventCaptor.getValue().geofenceId());
    }

    @Test
    void createGeofenceRejectsDuplicateName() {
        when(geofenceRepository.existsByNameIgnoreCase("RANGE-A")).thenReturn(true);

        assertThrows(GeofenceConflictException.class,
                () -> geofenceService.createGeofence(request("RANGE-A", true, triangle())));
    }

    @Test
    void updateGeofenceRejectsMissingAndConflictingRecords() {
        when(geofenceRepository.findById(10L)).thenReturn(Optional.empty());

        assertThrows(GeofenceNotFoundException.class,
                () -> geofenceService.updateGeofence(10L, request("R", true, triangle())));

        GeofenceEntity existing = entity(11L, "OLD", true);
        when(geofenceRepository.findById(11L)).thenReturn(Optional.of(existing));
        when(geofenceRepository.existsByNameIgnoreCaseAndIdNot("NEW", 11L)).thenReturn(true);

        assertThrows(GeofenceConflictException.class,
                () -> geofenceService.updateGeofence(11L, request("NEW", true, triangle())));
    }

    @Test
    void updateGeofenceReplacesPointsAndKeepsActiveWhenNullProvided() {
        GeofenceEntity existing = entity(12L, "OLD", false);
        when(geofenceRepository.findById(12L)).thenReturn(Optional.of(existing));
        when(geofenceRepository.existsByNameIgnoreCaseAndIdNot("NEW", 12L)).thenReturn(false);
        when(geofenceRepository.findAllByActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of());

        GeofenceDTO updated = geofenceService.updateGeofence(12L, request("NEW", null, triangle()));

        assertEquals("NEW", updated.getName());
        assertEquals(false, updated.isActive());
        assertEquals(3, updated.getPoints().size());
    }

    @Test
    void setActiveAndDeleteGeofenceTriggerCacheRefreshAndEvents() {
        GeofenceEntity geofence = entity(20L, "A", true);
        when(geofenceRepository.findById(20L)).thenReturn(Optional.of(geofence));
        when(geofenceRepository.findAllByActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of());

        GeofenceDTO deactivated = geofenceService.setActive(20L, false);
        assertEquals(false, deactivated.isActive());

        geofenceService.deleteGeofence(20L);
        verify(geofenceRepository).delete(geofence);
        verify(eventPublisher, times(2)).publishEvent(new GeofenceTopologyChangedEvent(20L));
    }

    @Test
    void validationRejectsBrokenPointSequenceAndOutOfRangeCoordinates() {
        when(geofenceRepository.existsByNameIgnoreCase("RANGE")).thenReturn(false);

        GeofenceRequestDTO badSequence = request("RANGE", true, List.of(
                point(1, 37.0, 23.0),
                point(2, 37.1, 23.1),
                point(3, 37.2, 23.2)
        ));

        assertThrows(GeofenceValidationException.class, () -> geofenceService.createGeofence(badSequence));

        GeofenceRequestDTO badLatitude = request("RANGE", true, List.of(
                point(0, 95.0, 23.0),
                point(1, 37.1, 23.1),
                point(2, 37.2, 23.2)
        ));

        assertThrows(GeofenceValidationException.class, () -> geofenceService.createGeofence(badLatitude));
    }

    @Test
    void listAndGetGeofenceMapEntitiesToDtos() {
        GeofenceEntity geofence = entity(30L, "RANGE", true);
        when(geofenceRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(geofence));
        when(geofenceRepository.findById(30L)).thenReturn(Optional.of(geofence));

        List<GeofenceDTO> list = geofenceService.listGeofences();
        GeofenceDTO single = geofenceService.getGeofence(30L);

        assertEquals(1, list.size());
        assertEquals("RANGE", single.getName());
    }

    private static GeofenceRequestDTO request(String name, Boolean isActive, List<GeofencePointDTO> points) {
        return GeofenceRequestDTO.builder()
                .name(name)
                .isActive(isActive)
                .points(points)
                .build();
    }

    private static List<GeofencePointDTO> triangle() {
        return List.of(
                point(0, 37.0, 23.0),
                point(1, 37.1, 23.1),
                point(2, 37.0, 23.2)
        );
    }

    private static GeofencePointDTO point(int sequence, double latitude, double longitude) {
        return GeofencePointDTO.builder()
                .sequence(sequence)
                .latitude(latitude)
                .longitude(longitude)
                .build();
    }

    private static GeofenceEntity entity(Long id, String name, boolean isActive) {
        GeofenceEntity geofence = GeofenceEntity.builder()
                .id(id)
                .name(name)
                .active(isActive)
                .createdAt(Instant.parse("2026-04-10T00:00:00Z"))
                .points(new ArrayList<>())
                .build();

        List<GeofencePointDTO> points = List.of(
                point(2, 37.0, 23.2),
                point(0, 37.0, 23.0),
                point(1, 37.1, 23.1)
        );

        for (GeofencePointDTO point : points) {
            geofence.getPoints().add(GeofencePointEntity.builder()
                    .geofence(geofence)
                    .sequence(point.getSequence())
                    .latitude(point.getLatitude())
                    .longitude(point.getLongitude())
                    .build());
        }
        return geofence;
    }
}
