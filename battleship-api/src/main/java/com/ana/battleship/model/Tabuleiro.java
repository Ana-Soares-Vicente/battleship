package com.ana.battleship.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tabuleiros")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Tabuleiro {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne @JoinColumn(name = "jogo_id", nullable = false)
    private Jogo jogo;

    @ManyToOne @JoinColumn(name = "dono_id", nullable = false)
    private Usuario dono;
}
