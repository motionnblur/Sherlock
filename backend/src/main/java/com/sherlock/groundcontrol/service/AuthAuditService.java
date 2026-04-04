package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.entity.AuthAuditLogEntity;
import com.sherlock.groundcontrol.repository.AuthAuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthAuditService {

    private static final int MAX_USER_AGENT_LENGTH = 256;

    private final AuthAuditLogRepository auditLogRepository;

    public void logAttempt(
            String username,
            String ipAddress,
            String userAgent,
            boolean success,
            String failureReason) {

        AuthAuditLogEntity entry = AuthAuditLogEntity.builder()
                .usernameAttempted(username)
                .ipAddress(ipAddress)
                .userAgent(truncate(userAgent, MAX_USER_AGENT_LENGTH))
                .success(success)
                .failureReason(failureReason)
                .build();

        auditLogRepository.save(entry);

        if (success) {
            log.info("[AUDIT] Login SUCCESS — user='{}' ip={}", username, ipAddress);
        } else {
            log.warn("[AUDIT] Login FAILURE — user='{}' ip={} reason={}", username, ipAddress, failureReason);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
