package com.ana.battleship.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "jogos")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Jogo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne @JoinColumn(name = "jogador1_id", nullable = false)
    private Usuario jogador1;

    @ManyToOne @JoinColumn(name = "jogador2_id")
    private Usuario jogador2;

    @ManyToOne @JoinColumn(name = "turno_atual_id")
    private Usuario turnoAtual;

    @ManyToOne @JoinColumn(name = "vencedor_id")
    private Usuario vencedor;

    @Column(nullable = false)
    private String status; // AGUARDANDO, POSICIONANDO, JOGANDO, FINALIZADO, EXPIRADO

    @Column(unique = true)
    private String token;

    private boolean jogador1Pronto;
    private boolean jogador2Pronto;

    private String skinJogador1;
    private String skinJogador2;

    @Column(nullable = false, columnDefinition = "varchar(255) default 'PADRAO'")
    @Builder.Default
    private String modo = "PADRAO"; // PADRAO, EXPLOSAO

    @Column(updatable = false)
    private Instant criadoEm;

    private Instant ultimaAtividade;

    @PrePersist
    void onCreate() {
        this.criadoEm = Instant.now();
        this.ultimaAtividade = Instant.now();
    }
}
