package com.sherlock.groundcontrol.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "telemetry", indexes = {
        @Index(name = "idx_telemetry_drone_timestamp", columnList = "drone_id, timestamp DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelemetryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "drone_id", nullable = false)
    private String droneId;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false)
    private Double altitude;

    @Column(nullable = false)
    private Double speed;

    @Column(nullable = false)
    private Double battery;

    @Column(nullable = false)
    private Double heading;

    @Column(nullable = false)
    private Instant timestamp;
}
