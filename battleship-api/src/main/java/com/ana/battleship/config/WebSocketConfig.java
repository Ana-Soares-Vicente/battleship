package com.ana.battleship.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // WebSocket nativo (usado pelo @stomp/stompjs com brokerURL)
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*");
        // SockJS fallback (caso queira usar SockJS também)
        registry.addEndpoint("/ws-sockjs").setAllowedOriginPatterns("*").withSockJS();
    }
}
