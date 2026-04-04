package com.sherlock.groundcontrol.dto;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelemetryDTO {

    private String droneId;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Double speed;
    private Double battery;
    private Double heading;
    private Instant timestamp;
}
