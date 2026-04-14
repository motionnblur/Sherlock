package com.sherlock.groundcontrol.config;

import com.sherlock.groundcontrol.security.JwtAuthenticationFilter;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SecurityConfigWebMvcTest.TestController.class)
@Import(SecurityConfig.class)
class SecurityConfigWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            Object[] args = invocation.getArguments();
            FilterChain chain = (FilterChain) args[2];
            chain.doFilter((jakarta.servlet.ServletRequest) args[0], (jakarta.servlet.ServletResponse) args[1]);
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    @Test
    void protectedEndpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/secured"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"error\":\"Authentication required\"}"));
    }

    @Test
    void loginEndpointIsPermittedWithoutAuthentication() throws Exception {
        mockMvc.perform(post("/api/auth/login"))
                .andExpect(result -> assertNotEquals(401, result.getResponse().getStatus()));
    }

    @RestController
    public static class TestController {

        @GetMapping("/secured")
        public ResponseEntity<String> secured() {
            return ResponseEntity.ok("secured");
        }

        @PostMapping("/api/auth/login")
        public ResponseEntity<String> login() {
            return ResponseEntity.ok("login-ok");
        }
    }
}
