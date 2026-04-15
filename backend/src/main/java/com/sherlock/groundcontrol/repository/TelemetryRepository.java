package com.sherlock.groundcontrol.repository;

import com.sherlock.groundcontrol.entity.TelemetryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface TelemetryRepository extends JpaRepository<TelemetryEntity, Long> {

    List<TelemetryEntity> findTop150ByDroneIdOrderByTimestampDesc(String droneId);

    List<TelemetryEntity> findByDroneIdAndTimestampBetweenOrderByTimestampAsc(String droneId, Instant start, Instant end);

    long countByDroneIdAndTimestampBetween(String droneId, Instant start, Instant end);

    Optional<TelemetryEntity> findFirstByDroneIdOrderByTimestampDesc(String droneId);
}
