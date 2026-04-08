package com.sherlock.groundcontrol.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeofenceAlertDTO {

    private String droneId;
    private Long geofenceId;
    private String geofenceName;
    private String eventType;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Instant timestamp;
}
