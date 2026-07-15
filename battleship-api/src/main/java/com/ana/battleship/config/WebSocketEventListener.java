package com.ana.battleship.config;

import com.ana.battleship.service.JogoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Set;
import java.util.concurrent.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final JogoService jogoService;

    // Mapeia sessionId -> username
    private final ConcurrentHashMap<String, String> sessionUserMap = new ConcurrentHashMap<>();

    // Rastreia usuários com sessões ativas (pode ter múltiplas sessões por usuário)
    private final ConcurrentHashMap<String, Set<String>> userSessionsMap = new ConcurrentHashMap<>();

    // Timers de grace period para abandono (30 segundos)
    private final ConcurrentHashMap<String, ScheduledFuture<?>> abandonTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private static final int GRACE_PERIOD_SECONDS = 30;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Principal user = event.getUser();

        if (user != null && user.getName() != null) {
            String username = user.getName();
            sessionUserMap.put(sessionId, username);
            userSessionsMap.computeIfAbsent(username, k -> ConcurrentHashMap.newKeySet()).add(sessionId);

            // Cancelar timer de abandono se existir (jogador reconectou)
            ScheduledFuture<?> timer = abandonTimers.remove(username);
            if (timer != null) {
                timer.cancel(false);
                log.info("WebSocket reconectado dentro do grace period: username={}", username);
            }

            log.info("WebSocket conectado: sessionId={}, username={}", sessionId, username);
        } else {
            log.warn("WebSocket conectado sem usuário autenticado: sessionId={}", sessionId);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();

        String username = sessionUserMap.remove(sessionId);
        if (username != null) {
            // Remover sessão do mapa de sessões do usuário
            Set<String> sessions = userSessionsMap.get(username);
            if (sessions != null) {
                sessions.remove(sessionId);

                // Só iniciar grace period se NÃO tem mais nenhuma sessão ativa
                if (sessions.isEmpty()) {
                    userSessionsMap.remove(username);
                    log.info("WebSocket desconectado (última sessão): username={}. Iniciando grace period de {}s", username, GRACE_PERIOD_SECONDS);

                    // Iniciar timer de grace period
                    ScheduledFuture<?> timer = scheduler.schedule(() -> {
                        abandonTimers.remove(username);
                        // Verificar se não reconectou durante o grace period
                        if (!userSessionsMap.containsKey(username)) {
                            log.info("Grace period expirado para {}. Abandonando partidas.", username);
                            try {
                                jogoService.abandonarPartida(username);
                            } catch (Exception e) {
                                log.error("Erro ao processar abandono para {}: {}", username, e.getMessage());
                            }
                        }
                    }, GRACE_PERIOD_SECONDS, TimeUnit.SECONDS);

                    abandonTimers.put(username, timer);
                } else {
                    log.debug("WebSocket desconectado, mas usuário {} ainda tem {} sessões ativas", username, sessions.size());
                }
            }
        }
    }
}
