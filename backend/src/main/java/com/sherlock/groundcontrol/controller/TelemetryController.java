package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.BulkLastKnownRequestDTO;
import com.sherlock.groundcontrol.dto.BulkLastKnownResponseDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.service.TelemetryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/telemetry")
@RequiredArgsConstructor
public class TelemetryController {

    private final TelemetryService telemetryService;

    @GetMapping("/history")
    public ResponseEntity<List<TelemetryDTO>> getHistory(@RequestParam String droneId) {
        return ResponseEntity.ok(telemetryService.getRecentHistory(droneId));
    }

    @PostMapping("/last-known")
    public ResponseEntity<BulkLastKnownResponseDTO> getBulkLastKnown(
            @RequestBody(required = false) BulkLastKnownRequestDTO request
    ) {
        List<String> droneIds = request != null ? request.getDroneIds() : List.of();
        BulkLastKnownResponseDTO response = BulkLastKnownResponseDTO.builder()
                .telemetry(telemetryService.getLastKnownByDroneIds(droneIds))
                .build();
        return ResponseEntity.ok(response);
    }
}
