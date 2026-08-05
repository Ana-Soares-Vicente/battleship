package com.ana.battleship.config;

import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.SimpMessagingTemplate;

/**
 * Fallback configuration when Redis is disabled.
 * Provides a WebSocketBroadcaster that only delivers messages locally
 * (no cross-pod relay), and uses in-memory cache.
 */
@Slf4j
@Configuration
@EnableCaching
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "false", matchIfMissing = true)
public class LocalWebSocketConfig {

    @Bean
    public RedisWebSocketRelay.WebSocketBroadcaster webSocketBroadcaster(
            SimpMessagingTemplate messagingTemplate,
            ObjectMapper objectMapper) {
        log.info("[WS-LOCAL] Redis disabled - WebSocket messages will only be delivered locally");
        return new RedisWebSocketRelay.WebSocketBroadcaster(null, messagingTemplate, objectMapper, "local");
    }
}
