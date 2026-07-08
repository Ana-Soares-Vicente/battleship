package com.ana.battleship.repository;

import com.ana.battleship.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TabuleiroRepository extends JpaRepository<Tabuleiro, Long> {
    Optional<Tabuleiro> findByJogoAndDono(Jogo jogo, Usuario dono);
}
