package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.repository.OperatorRepository;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DevDataInitializerTest {

    @Mock
    private OperatorRepository operatorRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void runReturnsImmediatelyWhenSeedCredentialsAreMissing() {
        Assumptions.assumeTrue(isBlank(System.getenv("DEV_SEED_USER")));
        Assumptions.assumeTrue(isBlank(System.getenv("DEV_SEED_PASSWORD")));

        DevDataInitializer initializer = new DevDataInitializer(operatorRepository, passwordEncoder);

        initializer.run(new DefaultApplicationArguments(new String[0]));

        verifyNoInteractions(operatorRepository, passwordEncoder);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
