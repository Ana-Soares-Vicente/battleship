package com.ana.battleship.repository;

import com.ana.battleship.model.Jogo;
import com.ana.battleship.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface JogoRepository extends JpaRepository<Jogo, Long> {
    List<Jogo> findByStatus(String status);

    Optional<Jogo> findByToken(String token);

    List<Jogo> findByStatusAndUltimaAtividadeAfter(String status, Instant threshold);

    List<Jogo> findByStatusAndUltimaAtividadeBefore(String status, Instant threshold);

    List<Jogo> findByStatusAndJogador1(String status, Usuario jogador1);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Jogo j SET j.jogador1Pronto = true WHERE j.id = :id")
    void marcarJogador1Pronto(@Param("id") Long id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Jogo j SET j.jogador2Pronto = true WHERE j.id = :id")
    void marcarJogador2Pronto(@Param("id") Long id);

    @Query("SELECT j FROM Jogo j WHERE (j.jogador1 = :jogador OR j.jogador2 = :jogador) AND j.status IN ('AGUARDANDO', 'POSICIONANDO', 'JOGANDO')")
    List<Jogo> findJogosAtivosDoJogador(@Param("jogador") Usuario jogador);

    @Query("SELECT j FROM Jogo j WHERE j.status IN ('JOGANDO', 'POSICIONANDO') AND j.ultimaAtividade < :threshold")
    List<Jogo> findJogosJogandoInativos(@Param("threshold") Instant threshold);
}
