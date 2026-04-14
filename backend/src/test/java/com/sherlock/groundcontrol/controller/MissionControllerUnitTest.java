package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.CreateMissionDTO;
import com.sherlock.groundcontrol.dto.MissionDTO;
import com.sherlock.groundcontrol.entity.MissionEntity;
import com.sherlock.groundcontrol.service.MissionExecutorService;
import com.sherlock.groundcontrol.service.MissionService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MissionControllerUnitTest {

    @Test
    void createMissionMapsValidationErrorsToBadRequest() {
        MissionService missionService = mock(MissionService.class);
        MissionExecutorService executorService = mock(MissionExecutorService.class);
        MissionController controller = new MissionController(missionService, executorService);

        when(missionService.createMission(any())).thenThrow(new IllegalArgumentException("invalid"));

        assertEquals(400, controller.createMission(new CreateMissionDTO()).getStatusCode().value());
    }

    @Test
    void executeMissionMapsAllServiceResults() {
        MissionService missionService = mock(MissionService.class);
        MissionExecutorService executorService = mock(MissionExecutorService.class);
        MissionController controller = new MissionController(missionService, executorService);

        MissionDTO dto = MissionDTO.builder().id(10L).build();
        when(missionService.getMission(10L)).thenReturn(Optional.of(dto));

        when(executorService.startExecution(10L, "MAVLINK-01")).thenReturn(MissionExecutorService.ExecuteResult.STARTED);
        assertEquals(202, controller.executeMission(10L, "MAVLINK-01").getStatusCode().value());

        when(executorService.startExecution(11L, "MAVLINK-01")).thenReturn(MissionExecutorService.ExecuteResult.MISSION_NOT_FOUND);
        assertEquals(404, controller.executeMission(11L, "MAVLINK-01").getStatusCode().value());

        when(executorService.startExecution(12L, "MAVLINK-01")).thenReturn(MissionExecutorService.ExecuteResult.MISSION_NOT_PLANNED);
        assertEquals(409, controller.executeMission(12L, "MAVLINK-01").getStatusCode().value());

        when(executorService.startExecution(13L, "MAVLINK-01")).thenReturn(MissionExecutorService.ExecuteResult.MAVLINK_UNAVAILABLE);
        assertEquals(503, controller.executeMission(13L, "MAVLINK-01").getStatusCode().value());

        assertEquals(400, controller.executeMission(10L, "   ").getStatusCode().value());
    }

    @Test
    void updateDeleteAndAbortMapStatuses() {
        MissionService missionService = mock(MissionService.class);
        MissionExecutorService executorService = mock(MissionExecutorService.class);
        MissionController controller = new MissionController(missionService, executorService);

        MissionDTO dto = MissionDTO.builder().id(5L).build();
        when(missionService.updateMission(any(), any()))
                .thenReturn(new MissionService.UpdateMissionResult(MissionService.UpdateMissionStatus.UPDATED, dto));
        assertEquals(200, controller.updateMission(5L, new CreateMissionDTO()).getStatusCode().value());

        when(missionService.updateMission(any(), any()))
                .thenReturn(new MissionService.UpdateMissionResult(MissionService.UpdateMissionStatus.MISSION_NOT_FOUND, null));
        assertEquals(404, controller.updateMission(5L, new CreateMissionDTO()).getStatusCode().value());

        when(missionService.updateMission(any(), any()))
                .thenReturn(new MissionService.UpdateMissionResult(MissionService.UpdateMissionStatus.MISSION_NOT_PLANNED, null));
        assertEquals(409, controller.updateMission(5L, new CreateMissionDTO()).getStatusCode().value());

        when(missionService.updateMission(any(), any())).thenThrow(new IllegalArgumentException("invalid"));
        assertEquals(400, controller.updateMission(5L, new CreateMissionDTO()).getStatusCode().value());

        when(missionService.deleteMission(6L)).thenReturn(true);
        when(missionService.deleteMission(7L)).thenReturn(false);
        assertEquals(204, controller.deleteMission(6L).getStatusCode().value());
        assertEquals(409, controller.deleteMission(7L).getStatusCode().value());

        when(executorService.abortExecution(8L)).thenReturn(true);
        when(missionService.getMission(8L)).thenReturn(Optional.of(MissionDTO.builder().id(8L).build()));
        assertEquals(200, controller.abortMission(8L).getStatusCode().value());

        when(executorService.abortExecution(9L)).thenReturn(false);
        assertEquals(409, controller.abortMission(9L).getStatusCode().value());
    }

    @Test
    void listAndGetMissionDelegateToService() {
        MissionService missionService = mock(MissionService.class);
        MissionExecutorService executorService = mock(MissionExecutorService.class);
        MissionController controller = new MissionController(missionService, executorService);

        when(missionService.listMissions()).thenReturn(List.of(MissionDTO.builder().id(1L).build()));
        when(missionService.getMission(1L)).thenReturn(Optional.of(MissionDTO.builder().id(1L).build()));
        when(missionService.getMission(2L)).thenReturn(Optional.empty());

        assertEquals(200, controller.listMissions().getStatusCode().value());
        assertEquals(200, controller.getMission(1L).getStatusCode().value());
        assertEquals(404, controller.getMission(2L).getStatusCode().value());
    }
}
