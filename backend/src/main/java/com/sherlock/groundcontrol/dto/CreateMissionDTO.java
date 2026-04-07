package com.sherlock.groundcontrol.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateMissionDTO {

    private String name;

    // Ordered list of waypoints; sequence is assigned by the server from list order
    private List<WaypointDTO> waypoints;
}
