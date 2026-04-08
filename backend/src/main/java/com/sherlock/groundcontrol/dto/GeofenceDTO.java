package com.sherlock.groundcontrol.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeofenceDTO {

    private Long id;
    private String name;
    private boolean isActive;
    private Instant createdAt;
    private List<GeofencePointDTO> points;
}
