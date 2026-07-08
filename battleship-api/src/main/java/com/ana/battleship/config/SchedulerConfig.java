package com.ana.battleship.config;

import com.ana.battleship.model.Jogo;
import com.ana.battleship.repository.JogoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Instant;
import java.util.List;

@Configuration
@EnableScheduling
@RequiredArgsConstructor
public class SchedulerConfig {

    private final JogoRepository jogoRepo;

    @Scheduled(fixedRate = 60000) // a cada 1 minuto
    public void limparSalasExpiradas() {
        Instant threshold = Instant.now().minusSeconds(120); // 2 min
        List<Jogo> expirados = jogoRepo.findByStatusAndUltimaAtividadeBefore("AGUARDANDO", threshold);
        for (Jogo jogo : expirados) {
            jogo.setStatus("EXPIRADO");
            jogoRepo.save(jogo);
        }
    }
}
