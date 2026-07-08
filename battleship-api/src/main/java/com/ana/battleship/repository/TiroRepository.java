package com.ana.battleship.repository;

import com.ana.battleship.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TiroRepository extends JpaRepository<Tiro, Long> {
    List<Tiro> findByJogoAndAtirador(Jogo jogo, Usuario atirador);
    List<Tiro> findByJogoAndAtiradorNot(Jogo jogo, Usuario atirador);
    boolean existsByJogoAndAtiradorAndLinhaAndColuna(Jogo jogo, Usuario atirador, int linha, int coluna);
}
