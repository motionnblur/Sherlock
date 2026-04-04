package com.sherlock.groundcontrol.security;

import com.sherlock.groundcontrol.entity.OperatorEntity;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

@RequiredArgsConstructor
public class OperatorUserDetails implements UserDetails {

    @Getter
    private final OperatorEntity operator;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_OPERATOR"));
    }

    @Override
    public String getPassword() {
        return operator.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return operator.getUsername();
    }

    @Override
    public boolean isAccountNonLocked() {
        Instant lockedUntil = operator.getLockedUntil();
        return lockedUntil == null || Instant.now().isAfter(lockedUntil);
    }

    @Override
    public boolean isAccountNonExpired() {
        // Account expiry is not modelled — token lifetime handles session expiry.
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        // Credential expiry is not modelled — JWT expiry enforces this at the token level.
        return true;
    }

    @Override
    public boolean isEnabled() {
        return operator.isEnabled();
    }
}
