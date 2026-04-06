package com.sherlock.groundcontrol.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class DroneCommandDTO {

    private CommandType commandType;
    private Double latitude;
    private Double longitude;
    private Double altitude;

    public enum CommandType {
        RTH,
        ARM,
        DISARM,
        TAKEOFF,
        GOTO
    }
}
