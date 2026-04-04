package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.LoginRequestDTO;
import com.sherlock.groundcontrol.dto.LoginResponseDTO;
import com.sherlock.groundcontrol.entity.OperatorEntity;
import com.sherlock.groundcontrol.entity.TokenBlacklistEntity;
import com.sherlock.groundcontrol.exception.AccountLockedException;
import com.sherlock.groundcontrol.exception.AuthenticationFailedException;
import com.sherlock.groundcontrol.repository.OperatorRepository;
import com.sherlock.groundcontrol.repository.TokenBlacklistRepository;
import com.sherlock.groundcontrol.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_DURATION_MINUTES = 30;

    private final OperatorRepository operatorRepository;
    private final TokenBlacklistRepository tokenBlacklistRepository;
    private final AuthAuditService auditService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public LoginResponseDTO authenticate(LoginRequestDTO request, String ipAddress, String userAgent) {
        String username = request.getUsername();

        // Always perform a password check — even for unknown users — to prevent timing attacks.
        OperatorEntity operator = operatorRepository.findByUsername(username).orElse(null);

        if (operator == null || !operator.isEnabled()) {
            // Perform a dummy check so response time is indistinguishable from a real failure.
            passwordEncoder.matches(request.getPassword(), "$2a$12$dummyhashtopreventtimingattacks00000000000000000000000");
            auditService.logAttempt(username, ipAddress, userAgent, false, "INVALID_CREDENTIALS");
            throw new AuthenticationFailedException("Authentication failed");
        }

        if (isLocked(operator)) {
            auditService.logAttempt(username, ipAddress, userAgent, false, "ACCOUNT_LOCKED");
            throw new AccountLockedException("Account temporarily locked — contact your system administrator");
        }

        if (!passwordEncoder.matches(request.getPassword(), operator.getPasswordHash())) {
            recordFailedAttempt(operator);
            auditService.logAttempt(username, ipAddress, userAgent, false, "INVALID_CREDENTIALS");
            throw new AuthenticationFailedException("Authentication failed");
        }

        operator.setFailedAttempts(0);
        operator.setLockedUntil(null);
        operator.setLastLoginAt(Instant.now());
        operatorRepository.save(operator);

        auditService.logAttempt(username, ipAddress, userAgent, true, null);

        String token = jwtTokenProvider.generateToken(username);
        Instant expiresAt = jwtTokenProvider.extractExpiry(token);

        return LoginResponseDTO.builder()
                .token(token)
                .username(username)
                .expiresAt(expiresAt)
                .build();
    }

    @Transactional
    public void logout(String token) {
        try {
            String jti = jwtTokenProvider.extractJti(token);
            Instant expiresAt = jwtTokenProvider.extractExpiry(token);

            TokenBlacklistEntity revoked = TokenBlacklistEntity.builder()
                    .jti(jti)
                    .expiresAt(expiresAt)
                    .revokedAt(Instant.now())
                    .build();

            tokenBlacklistRepository.save(revoked);
            log.info("[AUTH] Token JTI {} blacklisted on logout", jti);
        } catch (Exception e) {
            log.warn("[AUTH] Could not blacklist token on logout: {}", e.getMessage());
        }
    }

    public boolean isTokenRevoked(String jti) {
        return tokenBlacklistRepository.existsByJti(jti);
    }

    /** Purges expired blacklist entries at 03:00 daily to keep the table lean. */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgeExpiredBlacklistEntries() {
        tokenBlacklistRepository.deleteByExpiresAtBefore(Instant.now());
        log.info("[AUTH] Expired token blacklist entries purged");
    }

    private boolean isLocked(OperatorEntity operator) {
        Instant lockedUntil = operator.getLockedUntil();
        return lockedUntil != null && Instant.now().isBefore(lockedUntil);
    }

    private void recordFailedAttempt(OperatorEntity operator) {
        int attempts = operator.getFailedAttempts() + 1;
        operator.setFailedAttempts(attempts);

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            Instant lockExpiry = Instant.now().plus(LOCKOUT_DURATION_MINUTES, ChronoUnit.MINUTES);
            operator.setLockedUntil(lockExpiry);
            log.warn("[AUTH] Operator '{}' locked for {} min after {} failed attempts",
                    operator.getUsername(), LOCKOUT_DURATION_MINUTES, attempts);
        }

        operatorRepository.save(operator);
    }
}
