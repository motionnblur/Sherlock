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

    // Extended fields — null when source is the lite fleet stream or data not yet received
    private Double roll;          // degrees, negative=left bank
    private Double pitch;         // degrees, negative=nose down
    private Double hdop;          // horizontal dilution of precision (lower = better)
    private Integer satelliteCount;
    private Integer fixType;      // 0=no fix, 2=2D, 3=3D, 4=DGPS, 5=RTK float, 6=RTK fixed
    private Integer rssi;         // 0–100 percent
    private Boolean isArmed;
    private String flightMode;    // e.g. "LOITER", "AUTO", "RTL"
}
