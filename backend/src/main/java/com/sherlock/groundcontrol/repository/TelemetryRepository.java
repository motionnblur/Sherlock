package com.sherlock.groundcontrol.repository;

import com.sherlock.groundcontrol.entity.TelemetryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TelemetryRepository extends JpaRepository<TelemetryEntity, Long> {

    List<TelemetryEntity> findTop100ByOrderByTimestampDesc();
}
