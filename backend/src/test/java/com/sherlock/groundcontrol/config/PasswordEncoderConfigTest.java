package com.sherlock.groundcontrol.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordEncoderConfigTest {

    @Test
    void passwordEncoderBeanProducesMatchingHashes() {
        PasswordEncoder encoder = new PasswordEncoderConfig().passwordEncoder();

        String rawPassword = "defense-grade-secret";
        String encoded = encoder.encode(rawPassword);

        assertTrue(encoder.matches(rawPassword, encoded));
    }
}
