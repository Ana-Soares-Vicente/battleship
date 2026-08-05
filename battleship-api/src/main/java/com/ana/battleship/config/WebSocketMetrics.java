package com.ana.battleship.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Exposes WebSocket metrics to Micrometer/Prometheus:
 * - battleship_players_online: unique players currently connected (gauge)
 * - spring_websocket_sessions: current active sessions (gauge)
 * - spring_websocket_messages_sent_total: messages sent to clients (counter)
 * - spring_websocket_messages_received_total: messages received from clients (counter)
 */
@Component
public class WebSocketMetrics {

    private final AtomicInteger activeSessions = new AtomicInteger(0);
    private final AtomicInteger playersOnline = new AtomicInteger(0);
    private final Counter messagesReceived;
    private final Counter messagesSent;

    public WebSocketMetrics(MeterRegistry meterRegistry) {
        Tags tags = Tags.of("application", "battleship-api");

        meterRegistry.gauge("spring_websocket_sessions", tags, activeSessions);
        meterRegistry.gauge("battleship_players_online", tags, playersOnline);

        this.messagesReceived = meterRegistry.counter("spring_websocket_messages_received_total", tags);
        this.messagesSent = meterRegistry.counter("spring_websocket_messages_sent_total", tags);
    }

    @EventListener
    public void onConnect(SessionConnectEvent event) {
        activeSessions.incrementAndGet();
        messagesReceived.increment();
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        activeSessions.decrementAndGet();
        messagesReceived.increment();
    }

    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        messagesReceived.increment();
    }

    public void recordMessageSent() {
        messagesSent.increment();
    }

    public int getActiveSessions() {
        return activeSessions.get();
    }

    public void playerConnected() {
        playersOnline.incrementAndGet();
    }

    public void playerDisconnected() {
        playersOnline.decrementAndGet();
    }
}
