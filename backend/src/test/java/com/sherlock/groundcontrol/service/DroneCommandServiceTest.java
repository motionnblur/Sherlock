package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.DroneCommandDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.ARM;
import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.GOTO;
import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.RTH;
import static com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType.TAKEOFF;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DroneCommandServiceTest {

    @Mock
    private MavlinkAdapterService mavlinkAdapterService;

    @Test
    void sendCommandReturnsDroneUnavailableWhenSystemIdCannotBeResolved() {
        DroneCommandService service = new DroneCommandService(mavlinkAdapterService);
        when(mavlinkAdapterService.resolveSystemId("MAVLINK-01")).thenReturn(Optional.empty());

        DroneCommandService.DispatchResult result = service.sendCommand("MAVLINK-01", command(RTH));

        assertEquals(DroneCommandService.DispatchResult.DRONE_UNAVAILABLE, result);
    }

    @Test
    void sendCommandDispatchesSingleCommands() {
        DroneCommandService service = new DroneCommandService(mavlinkAdapterService);
        when(mavlinkAdapterService.resolveSystemId("MAVLINK-01")).thenReturn(Optional.of(1));
        when(mavlinkAdapterService.nextSeqNum()).thenReturn(1, 2);
        when(mavlinkAdapterService.sendPacket(eq(1), any(byte[].class))).thenReturn(true, false);

        DroneCommandService.DispatchResult arm = service.sendCommand("MAVLINK-01", command(ARM));
        DroneCommandService.DispatchResult rth = service.sendCommand("MAVLINK-01", command(RTH));

        assertEquals(DroneCommandService.DispatchResult.DISPATCHED, arm);
        assertEquals(DroneCommandService.DispatchResult.DRONE_UNAVAILABLE, rth);
    }

    @Test
    void sendCommandTakeoffReturnsNotReadyWhenSequenceCannotStart() {
        DroneCommandService service = new DroneCommandService(mavlinkAdapterService);
        when(mavlinkAdapterService.resolveSystemId("MAVLINK-01")).thenReturn(Optional.of(1));
        when(mavlinkAdapterService.nextSeqNum()).thenReturn(1);
        when(mavlinkAdapterService.sendPacket(eq(1), any(byte[].class))).thenReturn(false);

        DroneCommandService.DispatchResult result = service.sendCommand("MAVLINK-01", command(TAKEOFF));

        assertEquals(DroneCommandService.DispatchResult.TAKEOFF_NOT_READY, result);
    }

    @Test
    void sendCommandTakeoffDispatchesWhenArmedStateConfirmed() {
        DroneCommandService service = new DroneCommandService(mavlinkAdapterService);
        when(mavlinkAdapterService.resolveSystemId("MAVLINK-01")).thenReturn(Optional.of(1));
        when(mavlinkAdapterService.nextSeqNum()).thenReturn(1, 2, 3);
        when(mavlinkAdapterService.sendPacket(eq(1), any(byte[].class))).thenReturn(true);
        when(mavlinkAdapterService.isDroneArmed(1)).thenReturn(true);

        DroneCommandService.DispatchResult result = service.sendCommand("MAVLINK-01", command(TAKEOFF));

        assertEquals(DroneCommandService.DispatchResult.DISPATCHED, result);
        verify(mavlinkAdapterService, times(3)).sendPacket(eq(1), any(byte[].class));
    }

    @Test
    void sendCommandGotoRejectsInvalidPayloadOrUnarmedVehicle() {
        DroneCommandService service = new DroneCommandService(mavlinkAdapterService);
        when(mavlinkAdapterService.resolveSystemId("MAVLINK-01")).thenReturn(Optional.of(1));

        DroneCommandDTO invalid = command(GOTO);
        invalid.setLatitude(37.0);

        DroneCommandService.DispatchResult invalidResult = service.sendCommand("MAVLINK-01", invalid);
        assertEquals(DroneCommandService.DispatchResult.NAVIGATION_NOT_READY, invalidResult);

        DroneCommandDTO valid = command(GOTO);
        valid.setLatitude(37.0);
        valid.setLongitude(23.0);
        valid.setAltitude(1300.0);
        when(mavlinkAdapterService.isDroneArmed(1)).thenReturn(false);

        DroneCommandService.DispatchResult unarmedResult = service.sendCommand("MAVLINK-01", valid);
        assertEquals(DroneCommandService.DispatchResult.NAVIGATION_NOT_READY, unarmedResult);
        verify(mavlinkAdapterService, never()).getAltitudeReference(1);
    }

    @Test
    void sendCommandGotoRequiresGuidedModeAndAltitudeReference() {
        DroneCommandService service = new DroneCommandService(mavlinkAdapterService);
        when(mavlinkAdapterService.resolveSystemId("MAVLINK-01")).thenReturn(Optional.of(1));
        when(mavlinkAdapterService.isDroneArmed(1)).thenReturn(true);
        when(mavlinkAdapterService.nextSeqNum()).thenReturn(1);
        when(mavlinkAdapterService.sendPacket(eq(1), any(byte[].class))).thenReturn(false);

        DroneCommandDTO gotoCommand = validGoto();

        DroneCommandService.DispatchResult result = service.sendCommand("MAVLINK-01", gotoCommand);

        assertEquals(DroneCommandService.DispatchResult.NAVIGATION_NOT_READY, result);
    }

    @Test
    void sendCommandGotoDispatchesWhenNavigationInputsAreReady() {
        DroneCommandService service = new DroneCommandService(mavlinkAdapterService);
        when(mavlinkAdapterService.resolveSystemId("MAVLINK-01")).thenReturn(Optional.of(1));
        when(mavlinkAdapterService.isDroneArmed(1)).thenReturn(true);
        when(mavlinkAdapterService.nextSeqNum()).thenReturn(1, 2);
        when(mavlinkAdapterService.sendPacket(eq(1), any(byte[].class))).thenReturn(true, true);
        when(mavlinkAdapterService.getAltitudeReference(1))
                .thenReturn(Optional.of(new MavlinkAdapterService.AltitudeReference(1400.0, 100.0)));

        DroneCommandService.DispatchResult result = service.sendCommand("MAVLINK-01", validGoto());

        assertEquals(DroneCommandService.DispatchResult.DISPATCHED, result);
        verify(mavlinkAdapterService, times(2)).sendPacket(eq(1), any(byte[].class));
    }

    private static DroneCommandDTO command(DroneCommandDTO.CommandType type) {
        DroneCommandDTO command = new DroneCommandDTO();
        command.setCommandType(type);
        return command;
    }

    private static DroneCommandDTO validGoto() {
        DroneCommandDTO command = command(GOTO);
        command.setLatitude(37.98);
        command.setLongitude(23.72);
        command.setAltitude(1520.0);
        return command;
    }
}
