package com.sherlock.groundcontrol.config;

import com.sherlock.groundcontrol.security.WebSocketAuthChannelInterceptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.SockJsServiceRegistration;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebSocketConfigTest {

    @Mock
    private WebSocketAuthChannelInterceptor webSocketAuthChannelInterceptor;

    @Test
    void configureMessageBrokerSetsBrokerAndAppPrefixes() {
        WebSocketConfig config = new WebSocketConfig(webSocketAuthChannelInterceptor);
        MessageBrokerRegistry registry = mock(MessageBrokerRegistry.class);
        when(registry.enableSimpleBroker("/topic")).thenReturn(null);

        config.configureMessageBroker(registry);

        verify(registry).enableSimpleBroker("/topic");
        verify(registry).setApplicationDestinationPrefixes("/app");
    }

    @Test
    void registerStompEndpointsConfiguresSockJsEndpoint() {
        WebSocketConfig config = new WebSocketConfig(webSocketAuthChannelInterceptor);
        StompEndpointRegistry registry = mock(StompEndpointRegistry.class);
        StompWebSocketEndpointRegistration endpointRegistration = mock(StompWebSocketEndpointRegistration.class);
        SockJsServiceRegistration sockJsRegistration = mock(SockJsServiceRegistration.class);

        when(registry.addEndpoint("/ws-skytrack")).thenReturn(endpointRegistration);
        when(endpointRegistration.setAllowedOriginPatterns("*")).thenReturn(endpointRegistration);
        when(endpointRegistration.withSockJS()).thenReturn(sockJsRegistration);

        config.registerStompEndpoints(registry);

        verify(registry).addEndpoint("/ws-skytrack");
        verify(endpointRegistration).setAllowedOriginPatterns("*");
        verify(endpointRegistration).withSockJS();
    }

    @Test
    void configureClientInboundChannelRegistersAuthInterceptor() {
        WebSocketConfig config = new WebSocketConfig(webSocketAuthChannelInterceptor);
        ChannelRegistration registration = mock(ChannelRegistration.class);
        when(registration.interceptors(webSocketAuthChannelInterceptor)).thenReturn(registration);

        config.configureClientInboundChannel(registration);

        verify(registration).interceptors(webSocketAuthChannelInterceptor);
    }
}
