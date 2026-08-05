package com.ana.battleship.config;

import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.Map;
import java.util.UUID;

/**
 * Redis Pub/Sub relay for WebSocket messages.
 * Ensures that STOMP messages sent on one pod are delivered to WebSocket
 * clients connected to other pods.
 * 
 * Flow:
 * 1. Service calls RedisWebSocketRelay.broadcast(destination, payload)
 * 2. Message is published to Redis channel "ws-relay"
 * 3. All pods (including sender) receive the message via subscription
 * 4. Each pod delivers to its local WebSocket clients via SimpMessagingTemplate
 */
@Slf4j
@Configuration
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true", matchIfMissing = false)
public class RedisWebSocketRelay {

    private static final String CHANNEL = "ws-relay";
    private final String podId = UUID.randomUUID().toString().substring(0, 8);

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            SimpMessagingTemplate messagingTemplate,
            ObjectMapper objectMapper) {

        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);

        MessageListener listener = (message, pattern) -> {
            try {
                String json = new String(message.getBody());
                Map<String, Object> envelope = objectMapper.readValue(json, Map.class);

                // Skip messages from this pod (already delivered locally)
                String sourcePod = (String) envelope.get("_podId");
                if (podId.equals(sourcePod)) {
                    return;
                }

                String destination = (String) envelope.get("_destination");
                Object payload = envelope.get("_payload");

                log.debug("[WS-RELAY] Received from pod {} -> {}", sourcePod, destination);
                messagingTemplate.convertAndSend(destination, payload);
            } catch (Exception e) {
                log.error("[WS-RELAY] Error processing message", e);
            }
        };

        container.addMessageListener(listener, new PatternTopic(CHANNEL));
        return container;
    }

    @Bean
    public WebSocketBroadcaster webSocketBroadcaster(
            StringRedisTemplate redisTemplate,
            SimpMessagingTemplate messagingTemplate,
            ObjectMapper objectMapper) {
        return new WebSocketBroadcaster(redisTemplate, messagingTemplate, objectMapper, podId);
    }

    @Slf4j
    public static class WebSocketBroadcaster {

        private final StringRedisTemplate redisTemplate;
        private final SimpMessagingTemplate messagingTemplate;
        private final ObjectMapper objectMapper;
        private final String podId;

        public WebSocketBroadcaster(StringRedisTemplate redisTemplate,
                                    SimpMessagingTemplate messagingTemplate,
                                    ObjectMapper objectMapper,
                                    String podId) {
            this.redisTemplate = redisTemplate;
            this.messagingTemplate = messagingTemplate;
            this.objectMapper = objectMapper;
            this.podId = podId;
        }

        /**
         * Broadcasts a message to all pods via Redis, and delivers locally.
         * Use this instead of messagingTemplate.convertAndSend() directly.
         */
        public void broadcast(String destination, Object payload) {
            // Deliver locally immediately
            messagingTemplate.convertAndSend(destination, payload);

            // Publish to Redis for other pods (skip if Redis is disabled)
            if (redisTemplate == null) {
                return;
            }
            try {
                Map<String, Object> envelope = Map.of(
                        "_podId", podId,
                        "_destination", destination,
                        "_payload", payload
                );
                String json = objectMapper.writeValueAsString(envelope);
                redisTemplate.convertAndSend(CHANNEL, json);
            } catch (Exception e) {
                log.error("[WS-RELAY] Error publishing to Redis", e);
            }
        }
    }
}
