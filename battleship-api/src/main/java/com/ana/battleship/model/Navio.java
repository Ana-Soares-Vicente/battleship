package com.ana.battleship.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "navios")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Navio {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne @JoinColumn(name = "tabuleiro_id", nullable = false)
    private Tabuleiro tabuleiro;

    @Column(nullable = false)
    private String tipo; // PORTA_AVIOES, ENCOURACADO, CRUZADOR, SUBMARINO, DESTROIER

    @Column(nullable = false)
    private int tamanho;

    @Column(nullable = false)
    private int linhaInicial;

    @Column(nullable = false)
    private int colunaInicial;

    @Column(nullable = false)
    private String direcao; // HORIZONTAL, VERTICAL

    private int acertos;

    public boolean estaAfundado() {
        return acertos >= tamanho;
    }

    public boolean ocupa(int linha, int coluna) {
        for (int i = 0; i < tamanho; i++) {
            int l = direcao.equals("VERTICAL") ? linhaInicial + i : linhaInicial;
            int c = direcao.equals("HORIZONTAL") ? colunaInicial + i : colunaInicial;
            if (l == linha && c == coluna) return true;
        }
        return false;
    }
}
