package com.sherlock.groundcontrol.dto;

import com.sherlock.groundcontrol.entity.WaypointEntity.WaypointStatus;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WaypointDTO {

    // Null when this DTO is part of a CreateMissionDTO (not yet persisted)
    private Long id;

    private Integer sequence;
    private Double latitude;
    private Double longitude;

    // Altitude in meters AMSL
    private Double altitude;

    private String label;

    // Null in create requests; populated in responses
    private WaypointStatus status;
}
