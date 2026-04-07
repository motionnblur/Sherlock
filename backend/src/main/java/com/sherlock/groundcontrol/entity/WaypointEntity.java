package com.sherlock.groundcontrol.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "mission_waypoints", indexes = {
        @Index(name = "idx_waypoint_mission_seq", columnList = "mission_id, sequence ASC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WaypointEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mission_id", nullable = false)
    private MissionEntity mission;

    @Column(nullable = false)
    private Integer sequence;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    // Altitude in meters AMSL — same frame as telemetry
    @Column(nullable = false)
    private Double altitude;

    @Column(length = 50)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WaypointStatus status;

    public enum WaypointStatus {
        PENDING, ACTIVE, REACHED, SKIPPED
    }
}
