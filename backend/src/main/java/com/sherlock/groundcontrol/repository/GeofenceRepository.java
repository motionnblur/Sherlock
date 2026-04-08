package com.sherlock.groundcontrol.repository;

import com.sherlock.groundcontrol.entity.GeofenceEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GeofenceRepository extends JpaRepository<GeofenceEntity, Long> {

    @Override
    @EntityGraph(attributePaths = "points")
    List<GeofenceEntity> findAll();

    @EntityGraph(attributePaths = "points")
    List<GeofenceEntity> findAllByOrderByCreatedAtDesc();

    @Override
    @EntityGraph(attributePaths = "points")
    Optional<GeofenceEntity> findById(Long id);

    @EntityGraph(attributePaths = "points")
    List<GeofenceEntity> findAllByActiveTrueOrderByCreatedAtDesc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
