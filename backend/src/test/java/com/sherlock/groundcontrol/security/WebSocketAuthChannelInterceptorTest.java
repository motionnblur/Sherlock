package com.sherlock.groundcontrol.security;

import com.sherlock.groundcontrol.service.AuthService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebSocketAuthChannelInterceptorTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private OperatorUserDetailsService userDetailsService;

    @Mock
    private AuthService authService;

    @Test
    void preSendPassesThroughNonConnectFrames() {
        WebSocketAuthChannelInterceptor interceptor = new WebSocketAuthChannelInterceptor(
                jwtTokenProvider,
                userDetailsService,
                authService
        );

        Message<byte[]> message = stompMessage(StompCommand.SEND, null);

        Message<?> result = interceptor.preSend(message, null);

        assertSame(message, result);
        verify(jwtTokenProvider, never()).parseAndValidate(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void preSendRejectsMissingAuthorizationHeader() {
        WebSocketAuthChannelInterceptor interceptor = new WebSocketAuthChannelInterceptor(
                jwtTokenProvider,
                userDetailsService,
                authService
        );

        Message<byte[]> connect = stompMessage(StompCommand.CONNECT, null);

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(connect, null));
    }

    @Test
    void preSendRejectsRevokedToken() {
        WebSocketAuthChannelInterceptor interceptor = new WebSocketAuthChannelInterceptor(
                jwtTokenProvider,
                userDetailsService,
                authService
        );

        Claims claims = mock(Claims.class);
        when(claims.getId()).thenReturn("jti-1");
        Jws<Claims> jws = mock(Jws.class);
        when(jws.getPayload()).thenReturn(claims);
        when(jwtTokenProvider.parseAndValidate("token")).thenReturn(jws);
        when(authService.isTokenRevoked("jti-1")).thenReturn(true);

        Message<byte[]> connect = stompMessage(StompCommand.CONNECT, "Bearer token");

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(connect, null));
    }

    @Test
    void preSendRejectsInvalidToken() {
        WebSocketAuthChannelInterceptor interceptor = new WebSocketAuthChannelInterceptor(
                jwtTokenProvider,
                userDetailsService,
                authService
        );

        when(jwtTokenProvider.parseAndValidate("bad")).thenThrow(new JwtException("invalid"));
        Message<byte[]> connect = stompMessage(StompCommand.CONNECT, "Bearer bad");

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(connect, null));
    }

    @Test
    void preSendAttachesAuthenticatedPrincipalForValidConnect() {
        WebSocketAuthChannelInterceptor interceptor = new WebSocketAuthChannelInterceptor(
                jwtTokenProvider,
                userDetailsService,
                authService
        );

        Claims claims = mock(Claims.class);
        when(claims.getId()).thenReturn("jti-2");
        when(claims.getSubject()).thenReturn("operator2");
        Jws<Claims> jws = mock(Jws.class);
        when(jws.getPayload()).thenReturn(claims);
        when(jwtTokenProvider.parseAndValidate("ok")).thenReturn(jws);
        when(authService.isTokenRevoked("jti-2")).thenReturn(false);

        UserDetails user = new User("operator2", "pw", List.of());
        when(userDetailsService.loadUserByUsername("operator2")).thenReturn(user);

        Message<byte[]> connect = stompMessage(StompCommand.CONNECT, "Bearer ok");
        Message<?> result = interceptor.preSend(connect, null);

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(result);
        assertNotNull(accessor.getUser());
    }

    private static Message<byte[]> stompMessage(StompCommand command, String authorization) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        if (authorization != null) {
            accessor.setNativeHeader("Authorization", authorization);
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
