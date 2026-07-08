package com.ana.battleship.repository;

import com.ana.battleship.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NavioRepository extends JpaRepository<Navio, Long> {
    List<Navio> findByTabuleiro(Tabuleiro tabuleiro);
}
