package com.sherlock.groundcontrol.dto;

import com.sherlock.groundcontrol.entity.MissionEntity.MissionStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MissionDTO {

    private Long id;
    private String name;

    // Populated after execute; null while PLANNED
    private String droneId;

    private MissionStatus status;
    private Instant createdAt;
    private Instant startedAt;
    private Instant completedAt;
    private List<WaypointDTO> waypoints;
}
