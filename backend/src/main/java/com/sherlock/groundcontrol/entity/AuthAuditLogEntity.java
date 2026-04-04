package com.sherlock.groundcontrol.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable audit record for every authentication attempt.
 * Never updated — only appended. No setters by design.
 */
@Entity
@Table(name = "auth_audit_log")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthAuditLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "username_attempted", nullable = false, length = 64)
    private String usernameAttempted;

    /** IPv4 or IPv6 address of the originating request. */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 256)
    private String userAgent;

    @Column(nullable = false)
    private boolean success;

    /** INVALID_CREDENTIALS | ACCOUNT_LOCKED | ACCOUNT_DISABLED — null on success. */
    @Column(name = "failure_reason", length = 32)
    private String failureReason;

    @Column(name = "attempted_at", nullable = false, updatable = false)
    private Instant attemptedAt;

    @PrePersist
    private void onPersist() {
        attemptedAt = Instant.now();
    }
}
