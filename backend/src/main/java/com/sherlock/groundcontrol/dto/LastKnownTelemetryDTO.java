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
public class LastKnownTelemetryDTO {

    private String droneId;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Double speed;
    private Double battery;
    private Double heading;
    private Instant timestamp;
}
