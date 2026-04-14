package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.StreamUrlDTO;
import com.sherlock.groundcontrol.service.DroneRegistryService;
import com.sherlock.groundcontrol.service.DroneStreamService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DroneStreamAndRegistryControllerUnitTest {

    @Test
    void getStreamUrlReturnsResolvedPayload() {
        DroneStreamService service = mock(DroneStreamService.class);
        when(service.resolveStreamUrl("SHERLOCK-01"))
                .thenReturn(StreamUrlDTO.builder().streamUrl("http://localhost/hls/1/index.m3u8").build());

        DroneStreamController controller = new DroneStreamController(service);
        var response = controller.getStreamUrl("SHERLOCK-01");

        assertEquals(200, response.getStatusCode().value());
        assertEquals("http://localhost/hls/1/index.m3u8", response.getBody().getStreamUrl());
    }

    @Test
    void getActiveDronesReturnsRegistryDto() {
        DroneRegistryService registryService = mock(DroneRegistryService.class);
        when(registryService.getActiveDroneIds()).thenReturn(List.of("MAVLINK-01", "SHERLOCK-01"));

        DroneRegistryController controller = new DroneRegistryController(registryService);
        var response = controller.getActiveDrones();

        assertEquals(200, response.getStatusCode().value());
        assertEquals(List.of("MAVLINK-01", "SHERLOCK-01"), response.getBody().getDroneIds());
    }
}
