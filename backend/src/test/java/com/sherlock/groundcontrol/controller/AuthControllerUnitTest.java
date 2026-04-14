package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.LoginRequestDTO;
import com.sherlock.groundcontrol.dto.LoginResponseDTO;
import com.sherlock.groundcontrol.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthControllerUnitTest {

    @Test
    void loginUsesForwardedForHeaderWhenPresent() {
        AuthService authService = mock(AuthService.class);
        AuthController controller = new AuthController(authService);
        LoginRequestDTO request = new LoginRequestDTO();
        request.setUsername("pilot");
        request.setPassword("pw");

        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.addHeader("X-Forwarded-For", "203.0.113.9, 10.0.0.2");
        servletRequest.addHeader("User-Agent", "test-agent");

        LoginResponseDTO response = LoginResponseDTO.builder()
                .token("jwt")
                .username("pilot")
                .expiresAt(Instant.parse("2026-04-15T00:00:00Z"))
                .build();
        when(authService.authenticate(request, "203.0.113.9", "test-agent")).thenReturn(response);

        var entity = controller.login(request, servletRequest);

        assertEquals(200, entity.getStatusCode().value());
        assertEquals("jwt", entity.getBody().getToken());
    }

    @Test
    void logoutCallsServiceOnlyForBearerHeader() {
        AuthService authService = mock(AuthService.class);
        AuthController controller = new AuthController(authService);

        var noContent = controller.logout("Bearer token-123");
        var noCall = controller.logout("Basic abc");

        assertEquals(204, noContent.getStatusCode().value());
        assertEquals(204, noCall.getStatusCode().value());
        verify(authService).logout("token-123");
        verify(authService, never()).logout("Basic abc");
    }
}
