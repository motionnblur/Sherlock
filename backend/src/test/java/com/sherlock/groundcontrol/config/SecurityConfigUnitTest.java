package com.sherlock.groundcontrol.config;

import com.sherlock.groundcontrol.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class SecurityConfigUnitTest {

    @Test
    void corsConfigurationSourceAllowsAnyOriginMethodAndHeader() {
        SecurityConfig config = new SecurityConfig(mock(JwtAuthenticationFilter.class));

        CorsConfigurationSource source = config.corsConfigurationSource();
        CorsConfiguration cors = source.getCorsConfiguration(new MockHttpServletRequest("GET", "/test"));

        assertTrue(cors.getAllowedOriginPatterns().contains("*"));
        assertTrue(cors.getAllowedMethods().contains("*"));
        assertTrue(cors.getAllowedHeaders().contains("*"));
        assertFalse(cors.getAllowCredentials());
        assertEquals(1, cors.getAllowedHeaders().size());
    }
}
