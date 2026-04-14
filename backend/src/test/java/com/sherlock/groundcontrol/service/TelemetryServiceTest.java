package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.LastKnownTelemetryDTO;
import com.sherlock.groundcontrol.dto.TelemetryDTO;
import com.sherlock.groundcontrol.entity.TelemetryEntity;
import com.sherlock.groundcontrol.repository.TelemetryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TelemetryServiceTest {

    @Mock
    private TelemetryRepository telemetryRepository;

    private TelemetryService telemetryService;

    @BeforeEach
    void setUp() {
        telemetryService = new TelemetryService(telemetryRepository, 2);
    }

    @Test
    void persistBatchIgnoresNullOrEmptyInput() {
        telemetryService.persistBatch(null);
        telemetryService.persistBatch(List.of());

        verify(telemetryRepository, never()).saveAll(anyList());
    }

    @Test
    void persistBatchMapsDefaultsAndUpdatesCache() {
        TelemetryDTO input = telemetry("SHERLOCK-01", null, null, null, null);

        telemetryService.persistBatch(List.of(input));

        ArgumentCaptor<List<TelemetryEntity>> entitiesCaptor = ArgumentCaptor.forClass(List.class);
        verify(telemetryRepository).saveAll(entitiesCaptor.capture());

        TelemetryEntity persisted = entitiesCaptor.getValue().get(0);
        assertEquals(0d, persisted.getSpeed());
        assertEquals(0d, persisted.getBattery());
        assertEquals(0d, persisted.getHeading());
        assertTrue(persisted.getTimestamp() != null);

        Optional<TelemetryDTO> cached = telemetryService.getLastKnown("SHERLOCK-01");
        assertTrue(cached.isPresent());
        assertEquals("SHERLOCK-01", cached.get().getDroneId());
        verify(telemetryRepository, never()).findFirstByDroneIdOrderByTimestampDesc("SHERLOCK-01");
    }

    @Test
    void getLastKnownReturnsEmptyForBlankDroneId() {
        assertTrue(telemetryService.getLastKnown(null).isEmpty());
        assertTrue(telemetryService.getLastKnown(" ").isEmpty());

        verify(telemetryRepository, never()).findFirstByDroneIdOrderByTimestampDesc(" ");
    }

    @Test
    void getLastKnownLoadsFromRepositoryAndCachesResult() {
        Instant timestamp = Instant.parse("2026-04-10T12:00:00Z");
        TelemetryEntity entity = telemetryEntity("SHERLOCK-02", timestamp);
        when(telemetryRepository.findFirstByDroneIdOrderByTimestampDesc("SHERLOCK-02"))
                .thenReturn(Optional.of(entity));

        Optional<TelemetryDTO> firstLoad = telemetryService.getLastKnown("SHERLOCK-02");
        Optional<TelemetryDTO> secondLoad = telemetryService.getLastKnown("SHERLOCK-02");

        assertTrue(firstLoad.isPresent());
        assertTrue(secondLoad.isPresent());
        assertEquals(timestamp, firstLoad.get().getTimestamp());
        verify(telemetryRepository, times(1)).findFirstByDroneIdOrderByTimestampDesc("SHERLOCK-02");
    }

    @Test
    void getRecentHistoryMapsRepositoryEntities() {
        Instant timestamp = Instant.parse("2026-04-09T12:00:00Z");
        when(telemetryRepository.findTop150ByDroneIdOrderByTimestampDesc("SHERLOCK-03"))
                .thenReturn(List.of(telemetryEntity("SHERLOCK-03", timestamp)));

        List<TelemetryDTO> history = telemetryService.getRecentHistory("SHERLOCK-03");

        assertEquals(1, history.size());
        assertEquals("SHERLOCK-03", history.get(0).getDroneId());
        assertEquals(84, history.get(0).getRssi());
        assertEquals("AUTO", history.get(0).getFlightMode());
    }

    @Test
    void getLastKnownByDroneIdsNormalizesAndSkipsMissing() {
        when(telemetryRepository.findFirstByDroneIdOrderByTimestampDesc("D1"))
                .thenReturn(Optional.of(telemetryEntity("D1", Instant.parse("2026-04-10T10:00:00Z"))));
        when(telemetryRepository.findFirstByDroneIdOrderByTimestampDesc("D2"))
                .thenReturn(Optional.empty());

        List<LastKnownTelemetryDTO> result = telemetryService.getLastKnownByDroneIds(
                Arrays.asList("D1", " ", "D1", "D2", null));

        assertEquals(1, result.size());
        assertEquals("D1", result.get(0).getDroneId());
    }

    @Test
    void cacheEvictsOldestEntryWhenCapacityReached() {
        TelemetryService singleEntryCacheService = new TelemetryService(telemetryRepository, 1);

        singleEntryCacheService.persistBatch(List.of(telemetry("D1", 1d, 10d, 45d, Instant.parse("2026-04-10T00:00:00Z"))));
        singleEntryCacheService.persistBatch(List.of(telemetry("D2", 2d, 20d, 90d, Instant.parse("2026-04-10T00:01:00Z"))));

        when(telemetryRepository.findFirstByDroneIdOrderByTimestampDesc("D1"))
                .thenReturn(Optional.of(telemetryEntity("D1", Instant.parse("2026-04-10T00:02:00Z"))));

        Optional<TelemetryDTO> d1 = singleEntryCacheService.getLastKnown("D1");
        assertTrue(d1.isPresent());
        verify(telemetryRepository).findFirstByDroneIdOrderByTimestampDesc("D1");
    }

    private static TelemetryDTO telemetry(String droneId, Double speed, Double battery, Double heading, Instant timestamp) {
        return TelemetryDTO.builder()
                .droneId(droneId)
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1000.0)
                .speed(speed)
                .battery(battery)
                .heading(heading)
                .timestamp(timestamp)
                .roll(1.0)
                .pitch(2.0)
                .hdop(0.9)
                .satelliteCount(12)
                .fixType(3)
                .rssi(84)
                .isArmed(true)
                .flightMode("AUTO")
                .build();
    }

    private static TelemetryEntity telemetryEntity(String droneId, Instant timestamp) {
        return TelemetryEntity.builder()
                .droneId(droneId)
                .latitude(37.0)
                .longitude(23.0)
                .altitude(1100.0)
                .speed(120.0)
                .battery(77.0)
                .heading(90.0)
                .timestamp(timestamp)
                .roll(1.1)
                .pitch(-0.5)
                .hdop(0.8)
                .satelliteCount(14)
                .fixType(3)
                .rssi(84)
                .armed(true)
                .flightMode("AUTO")
                .build();
    }
}
