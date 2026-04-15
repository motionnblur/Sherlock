package com.sherlock.groundcontrol.dto;

import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommandLifecycleDTO {

    private String commandId;
    private String droneId;
    private CommandType commandType;
    private CommandStatus status;
    private Instant requestedAt;
    private Instant updatedAt;
    private String detail;

    public enum CommandStatus {
        PENDING,
        SENT,
        ACKED,
        REJECTED,
        TIMEOUT,
        FAILED
    }
}
