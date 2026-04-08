package com.sherlock.groundcontrol.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeofencePointDTO {

    private Long id;
    private Integer sequence;
    private Double latitude;
    private Double longitude;
}
