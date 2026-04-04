package com.sherlock.groundcontrol.controller;

import com.sherlock.groundcontrol.dto.LoginRequestDTO;
import com.sherlock.groundcontrol.dto.LoginResponseDTO;
import com.sherlock.groundcontrol.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(
            @RequestBody LoginRequestDTO request,
            HttpServletRequest httpRequest) {

        String ipAddress = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");

        LoginResponseDTO response = authService.authenticate(request, ipAddress, userAgent);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String authHeader) {
        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX)) {
            authService.logout(authHeader.substring(BEARER_PREFIX.length()));
        }
        return ResponseEntity.noContent().build();
    }

    /** Respects X-Forwarded-For for reverse-proxy deployments. */
    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
