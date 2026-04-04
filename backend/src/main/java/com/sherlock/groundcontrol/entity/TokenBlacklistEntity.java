package com.sherlock.groundcontrol.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Stores revoked JWT IDs so logged-out tokens cannot be reused before they expire.
 * Entries are pruned daily once their expiry passes.
 */
@Entity
@Table(
    name = "token_blacklist",
    indexes = @Index(name = "idx_token_blacklist_jti", columnList = "jti")
)
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenBlacklistEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 36)
    private String jti;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at", nullable = false)
    private Instant revokedAt;
}
