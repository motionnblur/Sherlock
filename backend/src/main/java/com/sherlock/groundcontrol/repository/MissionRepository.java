package com.sherlock.groundcontrol.repository;

import com.sherlock.groundcontrol.entity.MissionEntity;
import com.sherlock.groundcontrol.entity.MissionEntity.MissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MissionRepository extends JpaRepository<MissionEntity, Long> {

    List<MissionEntity> findAllByOrderByCreatedAtDesc();

    List<MissionEntity> findByStatus(MissionStatus status);
}
