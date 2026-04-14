package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.CreateMissionDTO;
import com.sherlock.groundcontrol.dto.MissionDTO;
import com.sherlock.groundcontrol.dto.WaypointDTO;
import com.sherlock.groundcontrol.entity.MissionEntity;
import com.sherlock.groundcontrol.entity.MissionEntity.MissionStatus;
import com.sherlock.groundcontrol.entity.WaypointEntity;
import com.sherlock.groundcontrol.entity.WaypointEntity.WaypointStatus;
import com.sherlock.groundcontrol.repository.MissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class MissionServiceTest {

    @Mock
    private MissionRepository missionRepository;

    private MissionService missionService;

    @BeforeEach
    void setUp() {
        missionService = new MissionService(missionRepository);
        lenient().when(missionRepository.save(any(MissionEntity.class))).thenAnswer(invocation -> {
            MissionEntity mission = invocation.getArgument(0);
            if (mission.getId() == null) {
                mission.setId(42L);
            }
            return mission;
        });
    }

    @Test
    void createMissionPersistsPlannedMissionWithSequencedWaypoints() {
        CreateMissionDTO request = request("  ALPHA  ", validWaypoints());

        MissionDTO created = missionService.createMission(request);

        assertEquals(42L, created.getId());
        assertEquals("ALPHA", created.getName());
        assertEquals(MissionStatus.PLANNED, created.getStatus());
        assertEquals(2, created.getWaypoints().size());
        assertEquals(0, created.getWaypoints().get(0).getSequence());
        assertEquals(1, created.getWaypoints().get(1).getSequence());

        ArgumentCaptor<MissionEntity> missionCaptor = ArgumentCaptor.forClass(MissionEntity.class);
        verify(missionRepository).save(missionCaptor.capture());
        assertNotNull(missionCaptor.getValue().getCreatedAt());
    }

    @Test
    void createMissionRejectsConsecutiveWaypointsThatAreTooClose() {
        List<WaypointDTO> closeWaypoints = List.of(
                waypoint(37.0, 23.0, 1000.0, "A"),
                waypoint(37.00001, 23.00001, 1010.0, "B")
        );

        IllegalArgumentException thrown = assertThrows(
                IllegalArgumentException.class,
                () -> missionService.createMission(request("ALPHA", closeWaypoints))
        );

        assertTrue(thrown.getMessage().contains("at least 5.0 meters apart"));
        verify(missionRepository, never()).save(any());
    }

    @Test
    void listAndGetMissionMapRepositoryEntitiesToDto() {
        MissionEntity mission = missionEntity(10L, MissionStatus.PLANNED, List.of(
                waypointEntity(0, WaypointStatus.PENDING),
                waypointEntity(1, WaypointStatus.PENDING)
        ));
        when(missionRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(mission));
        when(missionRepository.findById(10L)).thenReturn(Optional.of(mission));

        List<MissionDTO> list = missionService.listMissions();
        Optional<MissionDTO> found = missionService.getMission(10L);

        assertEquals(1, list.size());
        assertTrue(found.isPresent());
        assertEquals("MISSION-10", found.get().getName());
    }

    @Test
    void deleteMissionReturnsFalseWhenMissingOrActive() {
        when(missionRepository.findById(1L)).thenReturn(Optional.empty());
        when(missionRepository.findById(2L)).thenReturn(Optional.of(missionEntity(2L, MissionStatus.ACTIVE, List.of())));

        boolean missing = missionService.deleteMission(1L);
        boolean active = missionService.deleteMission(2L);

        assertEquals(false, missing);
        assertEquals(false, active);
        verify(missionRepository, never()).deleteById(2L);
    }

    @Test
    void deleteMissionDeletesWhenNotActive() {
        when(missionRepository.findById(3L)).thenReturn(Optional.of(missionEntity(3L, MissionStatus.COMPLETED, List.of())));

        boolean deleted = missionService.deleteMission(3L);

        assertTrue(deleted);
        verify(missionRepository).deleteById(3L);
    }

    @Test
    void updateMissionHandlesMissingAndNotPlanned() {
        when(missionRepository.findById(100L)).thenReturn(Optional.empty());
        MissionEntity active = missionEntity(101L, MissionStatus.ACTIVE, List.of(waypointEntity(0, WaypointStatus.ACTIVE)));
        when(missionRepository.findById(101L)).thenReturn(Optional.of(active));

        MissionService.UpdateMissionResult missing = missionService.updateMission(100L, request("M", validWaypoints()));
        MissionService.UpdateMissionResult notPlanned = missionService.updateMission(101L, request("M", validWaypoints()));

        assertEquals(MissionService.UpdateMissionStatus.MISSION_NOT_FOUND, missing.status());
        assertEquals(MissionService.UpdateMissionStatus.MISSION_NOT_PLANNED, notPlanned.status());
    }

    @Test
    void updateMissionOverwritesNameAndWaypointsWhenPlanned() {
        MissionEntity planned = missionEntity(55L, MissionStatus.PLANNED, new ArrayList<>(List.of(
                waypointEntity(0, WaypointStatus.PENDING),
                waypointEntity(1, WaypointStatus.PENDING)
        )));
        when(missionRepository.findById(55L)).thenReturn(Optional.of(planned));

        MissionService.UpdateMissionResult result = missionService.updateMission(55L, request("  BRAVO  ", List.of(
                waypoint(37.0, 23.0, 1200.0, "N1"),
                waypoint(37.0002, 23.0002, 1300.0, "N2"),
                waypoint(37.0004, 23.0004, 1400.0, "N3")
        )));

        assertEquals(MissionService.UpdateMissionStatus.UPDATED, result.status());
        assertNotNull(result.mission());
        assertEquals("BRAVO", result.mission().getName());
        assertEquals(3, result.mission().getWaypoints().size());
        assertEquals(2, result.mission().getWaypoints().get(2).getSequence());
    }

    @Test
    void activateMissionTransitionsPlannedMissionAndActivatesFirstWaypoint() {
        MissionEntity planned = missionEntity(7L, MissionStatus.PLANNED, new ArrayList<>(List.of(
                waypointEntity(0, WaypointStatus.PENDING),
                waypointEntity(1, WaypointStatus.PENDING)
        )));
        when(missionRepository.findById(7L)).thenReturn(Optional.of(planned));

        Optional<MissionEntity> activated = missionService.activateMission(7L, "MAVLINK-01");

        assertTrue(activated.isPresent());
        assertEquals(MissionStatus.ACTIVE, activated.get().getStatus());
        assertEquals("MAVLINK-01", activated.get().getDroneId());
        assertNotNull(activated.get().getStartedAt());
        assertEquals(WaypointStatus.ACTIVE, activated.get().getWaypoints().get(0).getStatus());
    }

    @Test
    void markWaypointReachedCompletesMissionAtLastWaypoint() {
        MissionEntity active = missionEntity(11L, MissionStatus.ACTIVE, new ArrayList<>(List.of(
                waypointEntity(0, WaypointStatus.REACHED),
                waypointEntity(1, WaypointStatus.ACTIVE)
        )));
        when(missionRepository.findById(11L)).thenReturn(Optional.of(active));

        Optional<MissionEntity> updated = missionService.markWaypointReached(11L, 1);

        assertTrue(updated.isPresent());
        assertEquals(WaypointStatus.REACHED, updated.get().getWaypoints().get(1).getStatus());
        assertEquals(MissionStatus.COMPLETED, updated.get().getStatus());
        assertNotNull(updated.get().getCompletedAt());
    }

    @Test
    void abortMissionSkipsPendingAndActiveWaypoints() {
        MissionEntity active = missionEntity(13L, MissionStatus.ACTIVE, new ArrayList<>(List.of(
                waypointEntity(0, WaypointStatus.REACHED),
                waypointEntity(1, WaypointStatus.ACTIVE),
                waypointEntity(2, WaypointStatus.PENDING)
        )));
        when(missionRepository.findById(13L)).thenReturn(Optional.of(active));

        Optional<MissionEntity> aborted = missionService.abortMission(13L);

        assertTrue(aborted.isPresent());
        assertEquals(MissionStatus.ABORTED, aborted.get().getStatus());
        assertEquals(WaypointStatus.SKIPPED, aborted.get().getWaypoints().get(1).getStatus());
        assertEquals(WaypointStatus.SKIPPED, aborted.get().getWaypoints().get(2).getStatus());
        assertNotNull(aborted.get().getCompletedAt());
    }

    @Test
    void abortMissionReturnsEmptyWhenMissionNotActive() {
        MissionEntity planned = missionEntity(14L, MissionStatus.PLANNED, List.of(waypointEntity(0, WaypointStatus.PENDING)));
        when(missionRepository.findById(14L)).thenReturn(Optional.of(planned));

        Optional<MissionEntity> aborted = missionService.abortMission(14L);

        assertTrue(aborted.isEmpty());
    }

    @Test
    void markWaypointReachedIgnoresOutOfRangeIndex() {
        MissionEntity active = missionEntity(18L, MissionStatus.ACTIVE, new ArrayList<>(List.of(
                waypointEntity(0, WaypointStatus.ACTIVE),
                waypointEntity(1, WaypointStatus.PENDING)
        )));
        when(missionRepository.findById(18L)).thenReturn(Optional.of(active));

        Optional<MissionEntity> updated = missionService.markWaypointReached(18L, 9);

        assertTrue(updated.isPresent());
        assertEquals(WaypointStatus.ACTIVE, updated.get().getWaypoints().get(0).getStatus());
        verify(missionRepository, never()).save(active);
    }

    private static CreateMissionDTO request(String name, List<WaypointDTO> waypoints) {
        return new CreateMissionDTO(name, waypoints);
    }

    private static List<WaypointDTO> validWaypoints() {
        return List.of(
                waypoint(37.0, 23.0, 1200.0, "W1"),
                waypoint(37.0001, 23.0001, 1300.0, "W2")
        );
    }

    private static WaypointDTO waypoint(double latitude, double longitude, double altitude, String label) {
        return WaypointDTO.builder()
                .latitude(latitude)
                .longitude(longitude)
                .altitude(altitude)
                .label(label)
                .build();
    }

    private static MissionEntity missionEntity(Long id, MissionStatus status, List<WaypointEntity> waypoints) {
        MissionEntity mission = MissionEntity.builder()
                .id(id)
                .name("MISSION-" + id)
                .status(status)
                .createdAt(Instant.parse("2026-04-10T00:00:00Z"))
                .waypoints(new ArrayList<>())
                .build();
        for (WaypointEntity waypoint : waypoints) {
            waypoint.setMission(mission);
            mission.getWaypoints().add(waypoint);
        }
        return mission;
    }

    private static WaypointEntity waypointEntity(int sequence, WaypointStatus status) {
        return WaypointEntity.builder()
                .sequence(sequence)
                .latitude(37.0 + sequence * 0.001)
                .longitude(23.0 + sequence * 0.001)
                .altitude(1200.0 + sequence * 10)
                .label("WP-" + sequence)
                .status(status)
                .build();
    }
}
