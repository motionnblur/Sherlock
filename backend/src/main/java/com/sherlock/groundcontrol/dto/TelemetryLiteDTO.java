package com.sherlock.groundcontrol.dto;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelemetryLiteDTO {

    private String droneId;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Double heading;
    private Instant timestamp;
}
