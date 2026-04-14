package com.sherlock.groundcontrol.security;

import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtTokenProviderTest {

    private static final String BASE64_SECRET = Base64.getEncoder().encodeToString(
            "1234567890123456789012345678901234567890123456789012345678901234".getBytes()
    );

    @Test
    void generateAndExtractTokenFields() {
        JwtTokenProvider provider = new JwtTokenProvider(BASE64_SECRET, 2);

        String token = provider.generateToken("operator1");

        assertEquals("operator1", provider.extractUsername(token));
        assertTrue(provider.extractJti(token) != null && !provider.extractJti(token).isBlank());

        Instant expiry = provider.extractExpiry(token);
        assertTrue(expiry.isAfter(Instant.now().plusSeconds(60)));
        assertTrue(expiry.isBefore(Instant.now().plusSeconds(3 * 60 * 60)));
    }

    @Test
    void parseAndValidateRejectsMalformedToken() {
        JwtTokenProvider provider = new JwtTokenProvider(BASE64_SECRET, 2);

        assertThrows(JwtException.class, () -> provider.parseAndValidate("not.a.jwt"));
    }
}
