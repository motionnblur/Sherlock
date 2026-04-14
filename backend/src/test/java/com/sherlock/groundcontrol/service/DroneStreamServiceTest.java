package com.sherlock.groundcontrol.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DroneStreamServiceTest {

    @Test
    void resolveStreamUrlBuildsLowercaseMediaMtxPath() {
        DroneStreamService service = new DroneStreamService("http://localhost:8888");

        String url = service.resolveStreamUrl("SHERLOCK-01").getStreamUrl();

        assertEquals("http://localhost:8888/sherlock-01/index.m3u8", url);
    }
}
