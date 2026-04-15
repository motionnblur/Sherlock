package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.LastKnownTelemetryDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.entity.TelemetryEntity;
import com.sherlock.groundcontrol.exception.TelemetryHistoryValidationException;
import com.sherlock.groundcontrol.repository.TelemetryRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.time.Instant;

@Service
public class TelemetryService {

    private static final int MIN_CACHE_SIZE = 1;
    private static final int MAX_BULK_LOOKUP_IDS = 5000;
    private static final int MAX_HISTORY_RANGE_POINTS = 20_000;

    private final TelemetryRepository telemetryRepository;
    private final Map<String, TelemetryDTO> lastKnownCache;
    private final int cacheSize;

    public TelemetryService(
            TelemetryRepository telemetryRepository,
            @Value("${app.telemetry.last-known-cache-size:10000}") int configuredCacheSize
    ) {
        this.telemetryRepository = telemetryRepository;
        this.cacheSize = Math.max(MIN_CACHE_SIZE, configuredCacheSize);
        this.lastKnownCache = Collections.synchronizedMap(new LinkedHashMap<>(cacheSize + 1, 0.75F, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, TelemetryDTO> eldestEntry) {
                return size() > TelemetryService.this.cacheSize;
            }
        });
    }

    public void persist(TelemetryDTO dto) {
        persistBatch(List.of(dto));
    }

    public void persistBatch(List<TelemetryDTO> telemetryBatch) {
        if (telemetryBatch == null || telemetryBatch.isEmpty()) {
            return;
        }

        List<TelemetryEntity> entities = telemetryBatch.stream()
                .map(this::toEntity)
                .toList();

        telemetryRepository.saveAll(entities);
        updateLastKnownCache(telemetryBatch);
    }

    public List<TelemetryDTO> getRecentHistory(String droneId) {
        return telemetryRepository.findTop150ByDroneIdOrderByTimestampDesc(droneId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public List<TelemetryDTO> getHistoryInRange(String droneId, Instant start, Instant end) {
        validateHistoryRange(droneId, start, end);
        long pointCount = telemetryRepository.countByDroneIdAndTimestampBetween(droneId, start, end);
        if (pointCount > MAX_HISTORY_RANGE_POINTS) {
            throw new TelemetryHistoryValidationException("Selected range exceeds 20000 telemetry points");
        }

        return telemetryRepository.findByDroneIdAndTimestampBetweenOrderByTimestampAsc(droneId, start, end)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public Optional<TelemetryDTO> getLastKnown(String droneId) {
        if (droneId == null || droneId.isBlank()) {
            return Optional.empty();
        }
        TelemetryDTO cached = lastKnownCache.get(droneId);
        if (cached != null) {
            return Optional.of(cached);
        }
        return telemetryRepository.findFirstByDroneIdOrderByTimestampDesc(droneId)
                .map(this::toDTO)
                .map(dto -> {
                    lastKnownCache.put(droneId, dto);
                    return dto;
                });
    }

    public List<LastKnownTelemetryDTO> getLastKnownByDroneIds(List<String> requestedDroneIds) {
        List<String> droneIds = normalizeDroneIds(requestedDroneIds);
        return droneIds.stream()
                .map(this::resolveLastKnownTelemetry)
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<LastKnownTelemetryDTO> resolveLastKnownTelemetry(String droneId) {
        TelemetryDTO cached = lastKnownCache.get(droneId);
        if (cached != null) {
            return Optional.of(toLastKnownDTO(cached));
        }

        return telemetryRepository.findFirstByDroneIdOrderByTimestampDesc(droneId)
                .map(this::toDTO)
                .map(telemetryDTO -> {
                    lastKnownCache.put(droneId, telemetryDTO);
                    return toLastKnownDTO(telemetryDTO);
                });
    }

    private void updateLastKnownCache(List<TelemetryDTO> telemetryBatch) {
        for (TelemetryDTO telemetry : telemetryBatch) {
            if (telemetry.getDroneId() != null) {
                lastKnownCache.put(telemetry.getDroneId(), telemetry);
            }
        }
    }

    private List<String> normalizeDroneIds(List<String> requestedDroneIds) {
        if (requestedDroneIds == null || requestedDroneIds.isEmpty()) {
            return List.of();
        }

        return requestedDroneIds.stream()
                .filter(droneId -> droneId != null && !droneId.isBlank())
                .distinct()
                .limit(MAX_BULK_LOOKUP_IDS)
                .toList();
    }

    private TelemetryEntity toEntity(TelemetryDTO dto) {
        return TelemetryEntity.builder()
                .droneId(dto.getDroneId())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .altitude(dto.getAltitude())
                .speed(orDefault(dto.getSpeed(), 0d))
                .battery(orDefault(dto.getBattery(), 0d))
                .heading(orDefault(dto.getHeading(), 0d))
                .timestamp(dto.getTimestamp() != null ? dto.getTimestamp() : Instant.now())
                .roll(dto.getRoll())
                .pitch(dto.getPitch())
                .hdop(dto.getHdop())
                .satelliteCount(dto.getSatelliteCount())
                .fixType(dto.getFixType())
                .rssi(dto.getRssi())
                .armed(dto.getIsArmed())
                .flightMode(dto.getFlightMode())
                .build();
    }

    private LastKnownTelemetryDTO toLastKnownDTO(TelemetryDTO dto) {
        return LastKnownTelemetryDTO.builder()
                .droneId(dto.getDroneId())
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .altitude(dto.getAltitude())
                .speed(dto.getSpeed())
                .battery(dto.getBattery())
                .heading(dto.getHeading())
                .timestamp(dto.getTimestamp())
                .roll(dto.getRoll())
                .pitch(dto.getPitch())
                .hdop(dto.getHdop())
                .satelliteCount(dto.getSatelliteCount())
                .fixType(dto.getFixType())
                .rssi(dto.getRssi())
                .isArmed(dto.getIsArmed())
                .flightMode(dto.getFlightMode())
                .build();
    }

    private TelemetryDTO toDTO(TelemetryEntity entity) {
        return TelemetryDTO.builder()
                .droneId(entity.getDroneId())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .altitude(entity.getAltitude())
                .speed(entity.getSpeed())
                .battery(entity.getBattery())
                .heading(entity.getHeading())
                .timestamp(entity.getTimestamp())
                .roll(entity.getRoll())
                .pitch(entity.getPitch())
                .hdop(entity.getHdop())
                .satelliteCount(entity.getSatelliteCount())
                .fixType(entity.getFixType())
                .rssi(entity.getRssi())
                .isArmed(entity.getArmed())
                .flightMode(entity.getFlightMode())
                .build();
    }

    private static double orDefault(Double value, double fallback) {
        return value != null ? value : fallback;
    }

    private static void validateHistoryRange(String droneId, Instant start, Instant end) {
        if (droneId == null || droneId.isBlank()) {
            throw new TelemetryHistoryValidationException("droneId is required");
        }
        if ((start == null && end != null) || (start != null && end == null)) {
            throw new TelemetryHistoryValidationException("start and end must be provided together");
        }
        if (start == null) {
            throw new TelemetryHistoryValidationException("start is required");
        }
        if (!start.isBefore(end)) {
            throw new TelemetryHistoryValidationException("start must be before end");
        }
    }
}
