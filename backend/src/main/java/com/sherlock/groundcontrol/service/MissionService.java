package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.CreateMissionDTO;
import com.sherlock.groundcontrol.dto.MissionDTO;
import com.sherlock.groundcontrol.dto.WaypointDTO;
import com.sherlock.groundcontrol.entity.MissionEntity;
import com.sherlock.groundcontrol.entity.MissionEntity.MissionStatus;
import com.sherlock.groundcontrol.entity.WaypointEntity;
import com.sherlock.groundcontrol.entity.WaypointEntity.WaypointStatus;
import com.sherlock.groundcontrol.repository.MissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * CRUD operations for missions and waypoints.
 * Execution lifecycle (PLANNED → ACTIVE → COMPLETED | ABORTED) is managed
 * by MissionExecutorService; this service handles only persistence.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MissionService {

    private static final int MAX_WAYPOINTS_PER_MISSION = 100;
    private static final int MAX_MISSION_NAME_LENGTH    = 100;

    private final MissionRepository missionRepository;

    @Transactional
    public MissionDTO createMission(CreateMissionDTO request) {
        validateCreateRequest(request);

        MissionEntity mission = MissionEntity.builder()
                .name(request.getName().strip())
                .status(MissionStatus.PLANNED)
                .createdAt(Instant.now())
                .build();

        List<WaypointEntity> waypoints = buildWaypoints(request.getWaypoints(), mission);
        mission.setWaypoints(waypoints);

        MissionEntity saved = missionRepository.save(mission);
        log.info("Mission '{}' created with id={} and {} waypoints", saved.getName(), saved.getId(), waypoints.size());
        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<MissionDTO> listMissions() {
        return missionRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<MissionDTO> getMission(Long missionId) {
        return missionRepository.findById(missionId).map(this::toDTO);
    }

    @Transactional
    public boolean deleteMission(Long missionId) {
        Optional<MissionEntity> found = missionRepository.findById(missionId);
        if (found.isEmpty()) {
            return false;
        }
        if (found.get().getStatus() == MissionStatus.ACTIVE) {
            log.warn("Attempted to delete active mission id={} — abort first", missionId);
            return false;
        }
        missionRepository.deleteById(missionId);
        log.info("Mission id={} deleted", missionId);
        return true;
    }

    /**
     * Transitions a PLANNED mission to ACTIVE, assigns the drone, and marks the first waypoint ACTIVE.
     * Returns the updated entity, or empty if the mission is not found or not in PLANNED state.
     */
    @Transactional
    public Optional<MissionEntity> activateMission(Long missionId, String droneId) {
        return missionRepository.findById(missionId).map(mission -> {
            if (mission.getStatus() != MissionStatus.PLANNED) {
                return null;
            }
            mission.setDroneId(droneId);
            mission.setStatus(MissionStatus.ACTIVE);
            mission.setStartedAt(Instant.now());

            if (!mission.getWaypoints().isEmpty()) {
                mission.getWaypoints().get(0).setStatus(WaypointStatus.ACTIVE);
            }

            return missionRepository.save(mission);
        });
    }

    @Transactional
    public Optional<MissionEntity> markWaypointReached(Long missionId, int waypointIndex) {
        return missionRepository.findById(missionId).map(mission -> {
            List<WaypointEntity> waypoints = mission.getWaypoints();
            if (waypointIndex < 0 || waypointIndex >= waypoints.size()) {
                return mission;
            }
            waypoints.get(waypointIndex).setStatus(WaypointStatus.REACHED);

            int nextIndex = waypointIndex + 1;
            if (nextIndex < waypoints.size()) {
                waypoints.get(nextIndex).setStatus(WaypointStatus.ACTIVE);
            } else {
                mission.setStatus(MissionStatus.COMPLETED);
                mission.setCompletedAt(Instant.now());
                log.info("Mission id={} COMPLETED — all {} waypoints reached", missionId, waypoints.size());
            }
            return missionRepository.save(mission);
        });
    }

    @Transactional
    public Optional<MissionEntity> abortMission(Long missionId) {
        return missionRepository.findById(missionId).map(mission -> {
            if (mission.getStatus() != MissionStatus.ACTIVE) {
                return null;
            }
            mission.getWaypoints().stream()
                    .filter(wp -> wp.getStatus() == WaypointStatus.ACTIVE || wp.getStatus() == WaypointStatus.PENDING)
                    .forEach(wp -> wp.setStatus(WaypointStatus.SKIPPED));
            mission.setStatus(MissionStatus.ABORTED);
            mission.setCompletedAt(Instant.now());
            log.info("Mission id={} ABORTED", missionId);
            return missionRepository.save(mission);
        });
    }

    public MissionDTO toDTO(MissionEntity entity) {
        List<WaypointDTO> waypointDTOs = entity.getWaypoints().stream()
                .map(this::toWaypointDTO)
                .toList();

        return MissionDTO.builder()
                .id(entity.getId())
                .name(entity.getName())
                .droneId(entity.getDroneId())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .waypoints(waypointDTOs)
                .build();
    }

    private WaypointDTO toWaypointDTO(WaypointEntity entity) {
        return WaypointDTO.builder()
                .id(entity.getId())
                .sequence(entity.getSequence())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .altitude(entity.getAltitude())
                .label(entity.getLabel())
                .status(entity.getStatus())
                .build();
    }

    private List<WaypointEntity> buildWaypoints(List<WaypointDTO> waypointDTOs, MissionEntity mission) {
        if (waypointDTOs == null || waypointDTOs.isEmpty()) {
            return List.of();
        }
        return waypointDTOs.stream()
                .limit(MAX_WAYPOINTS_PER_MISSION)
                .map(dto -> WaypointEntity.builder()
                        .mission(mission)
                        .sequence(waypointDTOs.indexOf(dto))
                        .latitude(dto.getLatitude())
                        .longitude(dto.getLongitude())
                        .altitude(dto.getAltitude())
                        .label(dto.getLabel())
                        .status(WaypointStatus.PENDING)
                        .build())
                .toList();
    }

    private static void validateCreateRequest(CreateMissionDTO request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("Mission name must not be blank");
        }
        if (request.getName().length() > MAX_MISSION_NAME_LENGTH) {
            throw new IllegalArgumentException("Mission name exceeds maximum length of " + MAX_MISSION_NAME_LENGTH);
        }
        if (request.getWaypoints() == null || request.getWaypoints().size() < 2) {
            throw new IllegalArgumentException("Mission must have at least 2 waypoints");
        }
        for (WaypointDTO wp : request.getWaypoints()) {
            if (wp.getLatitude() == null || wp.getLongitude() == null || wp.getAltitude() == null) {
                throw new IllegalArgumentException("All waypoints must have latitude, longitude, and altitude");
            }
        }
    }
}
