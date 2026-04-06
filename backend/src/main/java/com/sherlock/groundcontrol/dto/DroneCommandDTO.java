package com.sherlock.groundcontrol.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class DroneCommandDTO {

    private CommandType commandType;

    public enum CommandType {
        RTH,
        ARM,
        DISARM,
        TAKEOFF
    }
}
