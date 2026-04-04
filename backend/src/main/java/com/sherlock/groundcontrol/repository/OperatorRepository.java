package com.sherlock.groundcontrol.repository;

import com.sherlock.groundcontrol.entity.OperatorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OperatorRepository extends JpaRepository<OperatorEntity, UUID> {

    Optional<OperatorEntity> findByUsername(String username);
}
