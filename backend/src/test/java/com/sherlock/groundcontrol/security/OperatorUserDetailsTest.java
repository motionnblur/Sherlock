package com.sherlock.groundcontrol.security;

import com.sherlock.groundcontrol.entity.OperatorEntity;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;

import java.time.Instant;
import java.util.Collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OperatorUserDetailsTest {

    @Test
    void exposesOperatorCredentialsAndRole() {
        OperatorEntity operator = OperatorEntity.builder()
                .username("operator")
                .passwordHash("hash")
                .enabled(true)
                .build();

        OperatorUserDetails details = new OperatorUserDetails(operator);

        assertEquals("operator", details.getUsername());
        assertEquals("hash", details.getPassword());
        Collection<? extends GrantedAuthority> authorities = details.getAuthorities();
        assertEquals(1, authorities.size());
        assertEquals("ROLE_OPERATOR", authorities.iterator().next().getAuthority());
        assertTrue(details.isEnabled());
        assertTrue(details.isAccountNonExpired());
        assertTrue(details.isCredentialsNonExpired());
    }

    @Test
    void accountNonLockedReflectsLockExpiration() {
        OperatorEntity locked = OperatorEntity.builder()
                .username("locked")
                .passwordHash("hash")
                .enabled(true)
                .lockedUntil(Instant.now().plusSeconds(120))
                .build();

        OperatorEntity unlocked = OperatorEntity.builder()
                .username("unlocked")
                .passwordHash("hash")
                .enabled(true)
                .lockedUntil(Instant.now().minusSeconds(120))
                .build();

        assertFalse(new OperatorUserDetails(locked).isAccountNonLocked());
        assertTrue(new OperatorUserDetails(unlocked).isAccountNonLocked());
    }
}
