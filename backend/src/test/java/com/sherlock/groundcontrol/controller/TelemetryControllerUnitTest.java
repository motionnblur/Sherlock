package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.BulkLastKnownRequestDTO;
import com.sherlock.groundcontrol.dto.LastKnownTelemetryDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.service.TelemetryService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TelemetryControllerUnitTest {

    @Test
    void getHistoryDelegatesToTelemetryService() {
        TelemetryService telemetryService = mock(TelemetryService.class);
        TelemetryController controller = new TelemetryController(telemetryService);
        when(telemetryService.getRecentHistory("SHERLOCK-01"))
                .thenReturn(List.of(TelemetryDTO.builder().droneId("SHERLOCK-01").build()));

        var response = controller.getHistory("SHERLOCK-01", null, null);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().size());
    }

    @Test
    void getHistoryWithRangeDelegatesToRangeService() {
        TelemetryService telemetryService = mock(TelemetryService.class);
        TelemetryController controller = new TelemetryController(telemetryService);
        Instant start = Instant.parse("2026-04-10T00:00:00Z");
        Instant end = Instant.parse("2026-04-10T01:00:00Z");
        when(telemetryService.getHistoryInRange("SHERLOCK-01", start, end))
                .thenReturn(List.of(TelemetryDTO.builder().droneId("SHERLOCK-01").build()));

        var response = controller.getHistory("SHERLOCK-01", start, end);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().size());
    }

    @Test
    void getBulkLastKnownHandlesNullRequestBody() {
        TelemetryService telemetryService = mock(TelemetryService.class);
        TelemetryController controller = new TelemetryController(telemetryService);
        when(telemetryService.getLastKnownByDroneIds(List.of()))
                .thenReturn(List.of(LastKnownTelemetryDTO.builder().droneId("SHERLOCK-01").build()));

        var response = controller.getBulkLastKnown(null);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().getTelemetry().size());
    }

    @Test
    void getBulkLastKnownPassesRequestedDroneIds() {
        TelemetryService telemetryService = mock(TelemetryService.class);
        TelemetryController controller = new TelemetryController(telemetryService);

        BulkLastKnownRequestDTO request = BulkLastKnownRequestDTO.builder()
                .droneIds(List.of("SHERLOCK-01"))
                .build();
        when(telemetryService.getLastKnownByDroneIds(List.of("SHERLOCK-01")))
                .thenReturn(List.of());

        var response = controller.getBulkLastKnown(request);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(0, response.getBody().getTelemetry().size());
    }
}
