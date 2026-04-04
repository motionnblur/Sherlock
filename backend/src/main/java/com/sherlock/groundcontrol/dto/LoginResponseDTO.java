package com.sherlock.groundcontrol.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class LoginResponseDTO {

    private String token;
    private String username;
    private Instant expiresAt;
}
