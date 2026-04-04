package com.sherlock.groundcontrol.repository;

import com.sherlock.groundcontrol.entity.AuthAuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AuthAuditLogRepository extends JpaRepository<AuthAuditLogEntity, UUID> {
}
