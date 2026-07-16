package com.ana.battleship.config;

import com.ana.battleship.model.Jogo;
import com.ana.battleship.model.Usuario;
import com.ana.battleship.repository.JogoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Configuration
@EnableScheduling
@RequiredArgsConstructor
public class SchedulerConfig {

    private final JogoRepository jogoRepo;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedRate = 60000) // a cada 1 minuto
    @Transactional
    public void limparSalasExpiradas() {
        Instant threshold = Instant.now().minusSeconds(120); // 2 min
        List<Jogo> expirados = jogoRepo.findByStatusAndUltimaAtividadeBefore("AGUARDANDO", threshold);
        for (Jogo jogo : expirados) {
            jogo.setStatus("EXPIRADO");
            jogoRepo.save(jogo);
        }
    }

    @Scheduled(fixedRate = 15000) // a cada 15 segundos
    @Transactional
    public void verificarInatividade() {
        Instant threshold = Instant.now().minusSeconds(120); // 2 min
        List<Jogo> inativos = jogoRepo.findJogosJogandoInativos(threshold);

        for (Jogo jogo : inativos) {
            // POSICIONANDO inativo → quem já se posicionou vence
            if ("POSICIONANDO".equals(jogo.getStatus())) {
                Usuario vencedor = null;
                Usuario perdedor = null;

                if (jogo.isJogador1Pronto() && !jogo.isJogador2Pronto()) {
                    vencedor = jogo.getJogador1();
                    perdedor = jogo.getJogador2();
                } else if (jogo.isJogador2Pronto() && !jogo.isJogador1Pronto()) {
                    vencedor = jogo.getJogador2();
                    perdedor = jogo.getJogador1();
                }

                if (vencedor != null) {
                    jogo.setStatus("FINALIZADO");
                    jogo.setVencedor(vencedor);
                    jogoRepo.save(jogo);
                    log.info("Jogo #{} finalizado por inatividade no POSICIONANDO. Vencedor: {}. Inativo: {}",
                            jogo.getId(), vencedor.getUsername(), perdedor != null ? perdedor.getUsername() : "?");

                    Map<String, Object> evento = new HashMap<>();
                    evento.put("tipo", "ABANDONO");
                    evento.put("motivo", "inatividade");
                    evento.put("jogadorInativo", perdedor != null ? perdedor.getUsername() : null);
                    evento.put("vencedor", vencedor.getUsername());
                    messagingTemplate.convertAndSend("/topic/jogo/" + jogo.getId(), (Object) evento);
                } else {
                    // Nenhum se posicionou → apenas expirar
                    jogo.setStatus("EXPIRADO");
                    jogoRepo.save(jogo);
                    log.info("Jogo #{} expirado por inatividade durante POSICIONANDO (nenhum pronto)", jogo.getId());

                    Map<String, Object> evento = new HashMap<>();
                    evento.put("tipo", "ABANDONO");
                    evento.put("motivo", "inatividade");
                    evento.put("vencedor", null);
                    messagingTemplate.convertAndSend("/topic/jogo/" + jogo.getId(), (Object) evento);
                }
                continue;
            }

            // JOGANDO inativo → quem tem o turno perde
            Usuario turnoAtual = jogo.getTurnoAtual();
            if (turnoAtual == null) continue;

            Usuario vencedor = jogo.getJogador1().getId().equals(turnoAtual.getId())
                    ? jogo.getJogador2() : jogo.getJogador1();

            jogo.setStatus("FINALIZADO");
            jogo.setVencedor(vencedor);
            jogoRepo.save(jogo);

            log.info("Jogo #{} finalizado por INATIVIDADE. Jogador inativo: {}. Vencedor: {}",
                    jogo.getId(), turnoAtual.getUsername(), vencedor.getUsername());

            Map<String, Object> evento = new HashMap<>();
            evento.put("tipo", "ABANDONO");
            evento.put("motivo", "inatividade");
            evento.put("jogadorInativo", turnoAtual.getUsername());
            evento.put("vencedor", vencedor.getUsername());
            messagingTemplate.convertAndSend("/topic/jogo/" + jogo.getId(), (Object) evento);
        }
    }
}
