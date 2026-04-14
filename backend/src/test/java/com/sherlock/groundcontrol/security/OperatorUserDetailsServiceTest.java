package com.sherlock.groundcontrol.security;

import com.sherlock.groundcontrol.entity.OperatorEntity;
import com.sherlock.groundcontrol.repository.OperatorRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OperatorUserDetailsServiceTest {

    @Mock
    private OperatorRepository operatorRepository;

    @Test
    void loadUserByUsernameReturnsUserDetailsWhenFound() {
        OperatorUserDetailsService service = new OperatorUserDetailsService(operatorRepository);
        OperatorEntity operator = OperatorEntity.builder()
                .username("pilot")
                .passwordHash("hash")
                .enabled(true)
                .build();
        when(operatorRepository.findByUsername("pilot")).thenReturn(Optional.of(operator));

        var details = service.loadUserByUsername("pilot");

        assertTrue(details instanceof OperatorUserDetails);
        assertEquals("pilot", details.getUsername());
    }

    @Test
    void loadUserByUsernameThrowsWhenMissing() {
        OperatorUserDetailsService service = new OperatorUserDetailsService(operatorRepository);
        when(operatorRepository.findByUsername("missing")).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class, () -> service.loadUserByUsername("missing"));
    }
}
