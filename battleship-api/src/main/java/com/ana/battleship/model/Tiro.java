package com.ana.battleship.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tiros")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Tiro {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne @JoinColumn(name = "jogo_id", nullable = false)
    private Jogo jogo;

    @ManyToOne @JoinColumn(name = "atirador_id", nullable = false)
    private Usuario atirador;

    @Column(name = "linha", nullable = false)
    private int linha;

    @Column(name = "coluna", nullable = false)
    private int coluna;

    @Column(nullable = false)
    private String resultado; // AGUA, ACERTO, AFUNDOU

    private String tipoNavioAfundado;
}
