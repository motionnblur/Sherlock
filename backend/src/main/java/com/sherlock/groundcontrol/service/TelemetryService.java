package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.entity.TelemetryEntity;
import com.sherlock.groundcontrol.repository.TelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TelemetryService {

    private final TelemetryRepository telemetryRepository;

    public void persist(TelemetryDTO dto) {
        TelemetryEntity entity = TelemetryEntity.builder()
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .altitude(dto.getAltitude())
                .speed(dto.getSpeed())
                .battery(dto.getBattery())
                .heading(dto.getHeading())
                .timestamp(dto.getTimestamp())
                .build();
        telemetryRepository.save(entity);
    }

    public List<TelemetryDTO> getRecentHistory() {
        return telemetryRepository.findTop100ByOrderByTimestampDesc()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private TelemetryDTO toDTO(TelemetryEntity entity) {
        return TelemetryDTO.builder()
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .altitude(entity.getAltitude())
                .speed(entity.getSpeed())
                .battery(entity.getBattery())
                .heading(entity.getHeading())
                .timestamp(entity.getTimestamp())
                .build();
    }
}
