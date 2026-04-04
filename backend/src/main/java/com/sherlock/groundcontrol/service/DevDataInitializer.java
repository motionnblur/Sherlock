package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.entity.OperatorEntity;
import com.sherlock.groundcontrol.repository.OperatorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates a seed operator on startup when DEV_SEED_USER and DEV_SEED_PASSWORD
 * are both set in the environment. Idempotent — skips if the username already exists.
 *
 * Leave both variables unset (or empty) in production. This component is a no-op
 * when either variable is absent.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DevDataInitializer implements ApplicationRunner {

    private final OperatorRepository operatorRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        String username = System.getenv("DEV_SEED_USER");
        String password = System.getenv("DEV_SEED_PASSWORD");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return;
        }

        if (operatorRepository.findByUsername(username).isPresent()) {
            log.info("[DEV] Seed operator '{}' already exists — skipping", username);
            return;
        }

        OperatorEntity operator = OperatorEntity.builder()
                .username(username)
                .passwordHash(passwordEncoder.encode(password))
                .enabled(true)
                .build();

        operatorRepository.save(operator);
        log.warn("[DEV] Seed operator '{}' created — ensure DEV_SEED_USER/DEV_SEED_PASSWORD are unset in production", username);
    }
}
