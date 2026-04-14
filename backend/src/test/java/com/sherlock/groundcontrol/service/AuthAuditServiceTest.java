package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.entity.AuthAuditLogEntity;
import com.sherlock.groundcontrol.repository.AuthAuditLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthAuditServiceTest {

    @Mock
    private AuthAuditLogRepository authAuditLogRepository;

    @Test
    void logAttemptTruncatesUserAgentAndPersistsRecord() {
        AuthAuditService service = new AuthAuditService(authAuditLogRepository);

        String longUserAgent = "u".repeat(300);
        service.logAttempt("operator", "10.0.0.1", longUserAgent, false, "INVALID_CREDENTIALS");

        ArgumentCaptor<AuthAuditLogEntity> captor = ArgumentCaptor.forClass(AuthAuditLogEntity.class);
        verify(authAuditLogRepository).save(captor.capture());

        AuthAuditLogEntity saved = captor.getValue();
        assertEquals("operator", saved.getUsernameAttempted());
        assertEquals("10.0.0.1", saved.getIpAddress());
        assertEquals(256, saved.getUserAgent().length());
        assertEquals(false, saved.isSuccess());
        assertEquals("INVALID_CREDENTIALS", saved.getFailureReason());
    }

    @Test
    void logAttemptAcceptsNullUserAgent() {
        AuthAuditService service = new AuthAuditService(authAuditLogRepository);

        service.logAttempt("operator", "10.0.0.1", null, true, null);

        ArgumentCaptor<AuthAuditLogEntity> captor = ArgumentCaptor.forClass(AuthAuditLogEntity.class);
        verify(authAuditLogRepository).save(captor.capture());
        assertNull(captor.getValue().getUserAgent());
        assertTrue(captor.getValue().isSuccess());
    }
}
