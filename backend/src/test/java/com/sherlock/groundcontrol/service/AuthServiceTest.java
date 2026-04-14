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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private OperatorRepository operatorRepository;

    @Mock
    private TokenBlacklistRepository tokenBlacklistRepository;

    @Mock
    private AuthAuditService auditService;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                operatorRepository,
                tokenBlacklistRepository,
                auditService,
                jwtTokenProvider,
                passwordEncoder
        );
    }

    @Test
    void authenticateRejectsUnknownUserAndRunsDummyPasswordCheck() {
        LoginRequestDTO request = request("ghost", "pw");
        when(operatorRepository.findByUsername("ghost")).thenReturn(Optional.empty());
        when(passwordEncoder.matches(eq("pw"), any(String.class))).thenReturn(false);

        assertThrows(AuthenticationFailedException.class,
                () -> authService.authenticate(request, "10.0.0.1", "agent"));

        verify(passwordEncoder).matches(eq("pw"), any(String.class));
        verify(auditService).logAttempt("ghost", "10.0.0.1", "agent", false, "INVALID_CREDENTIALS");
    }

    @Test
    void authenticateRejectsLockedUser() {
        OperatorEntity operator = enabledOperator("pilot");
        operator.setLockedUntil(Instant.now().plus(5, ChronoUnit.MINUTES));
        when(operatorRepository.findByUsername("pilot")).thenReturn(Optional.of(operator));

        assertThrows(AccountLockedException.class,
                () -> authService.authenticate(request("pilot", "pw"), "ip", "ua"));

        verify(auditService).logAttempt("pilot", "ip", "ua", false, "ACCOUNT_LOCKED");
    }

    @Test
    void authenticateIncrementsFailedAttemptsAndLocksAtThreshold() {
        OperatorEntity operator = enabledOperator("pilot");
        operator.setFailedAttempts(4);
        when(operatorRepository.findByUsername("pilot")).thenReturn(Optional.of(operator));
        when(passwordEncoder.matches("bad", operator.getPasswordHash())).thenReturn(false);

        assertThrows(AuthenticationFailedException.class,
                () -> authService.authenticate(request("pilot", "bad"), "ip", "ua"));

        assertEquals(5, operator.getFailedAttempts());
        assertNotNull(operator.getLockedUntil());
        verify(operatorRepository).save(operator);
        verify(auditService).logAttempt("pilot", "ip", "ua", false, "INVALID_CREDENTIALS");
    }

    @Test
    void authenticateReturnsTokenForValidCredentials() {
        OperatorEntity operator = enabledOperator("pilot");
        when(operatorRepository.findByUsername("pilot")).thenReturn(Optional.of(operator));
        when(passwordEncoder.matches("good", operator.getPasswordHash())).thenReturn(true);
        when(jwtTokenProvider.generateToken("pilot")).thenReturn("jwt-token");

        Instant expiry = Instant.parse("2026-04-15T00:00:00Z");
        when(jwtTokenProvider.extractExpiry("jwt-token")).thenReturn(expiry);

        LoginResponseDTO response = authService.authenticate(request("pilot", "good"), "ip", "ua");

        assertEquals("jwt-token", response.getToken());
        assertEquals("pilot", response.getUsername());
        assertEquals(expiry, response.getExpiresAt());
        assertEquals(0, operator.getFailedAttempts());
        assertEquals(null, operator.getLockedUntil());
        assertNotNull(operator.getLastLoginAt());
        verify(auditService).logAttempt("pilot", "ip", "ua", true, null);
    }

    @Test
    void logoutBlacklistsTokenWhenParsingSucceeds() {
        when(jwtTokenProvider.extractJti("token")).thenReturn("jti-1");
        Instant expiresAt = Instant.parse("2026-04-15T12:00:00Z");
        when(jwtTokenProvider.extractExpiry("token")).thenReturn(expiresAt);

        authService.logout("token");

        ArgumentCaptor<TokenBlacklistEntity> captor = ArgumentCaptor.forClass(TokenBlacklistEntity.class);
        verify(tokenBlacklistRepository).save(captor.capture());
        assertEquals("jti-1", captor.getValue().getJti());
        assertEquals(expiresAt, captor.getValue().getExpiresAt());
        assertNotNull(captor.getValue().getRevokedAt());
    }

    @Test
    void logoutSwallowsProviderErrors() {
        when(jwtTokenProvider.extractJti("token")).thenThrow(new IllegalArgumentException("bad token"));

        authService.logout("token");

        verify(tokenBlacklistRepository, never()).save(any());
    }

    @Test
    void isTokenRevokedDelegatesToRepository() {
        when(tokenBlacklistRepository.existsByJti("jti-2")).thenReturn(true);

        assertTrue(authService.isTokenRevoked("jti-2"));
    }

    @Test
    void purgeExpiredBlacklistEntriesDeletesByCurrentTime() {
        authService.purgeExpiredBlacklistEntries();

        verify(tokenBlacklistRepository, times(1)).deleteByExpiresAtBefore(any(Instant.class));
    }

    @Test
    void authenticateRejectsDisabledUser() {
        OperatorEntity operator = enabledOperator("pilot");
        operator.setEnabled(false);
        when(operatorRepository.findByUsername("pilot")).thenReturn(Optional.of(operator));
        when(passwordEncoder.matches(eq("pw"), any(String.class))).thenReturn(false);

        assertThrows(AuthenticationFailedException.class,
                () -> authService.authenticate(request("pilot", "pw"), "ip", "ua"));

        verify(auditService).logAttempt("pilot", "ip", "ua", false, "INVALID_CREDENTIALS");
    }

    private static LoginRequestDTO request(String username, String password) {
        LoginRequestDTO request = new LoginRequestDTO();
        request.setUsername(username);
        request.setPassword(password);
        return request;
    }

    private static OperatorEntity enabledOperator(String username) {
        return OperatorEntity.builder()
                .username(username)
                .passwordHash("hashed")
                .enabled(true)
                .failedAttempts(0)
                .build();
    }
}
