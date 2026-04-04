package com.sherlock.groundcontrol.repository;

import com.sherlock.groundcontrol.entity.TokenBlacklistEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.UUID;

public interface TokenBlacklistRepository extends JpaRepository<TokenBlacklistEntity, UUID> {

    boolean existsByJti(String jti);

    void deleteByExpiresAtBefore(Instant cutoff);
}
