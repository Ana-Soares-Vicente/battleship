package com.ana.battleship;

import com.ana.battleship.model.Jogo;
import com.ana.battleship.model.Usuario;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class JogoTest {

    private final Usuario jogador1 = Usuario.builder().id(1L).username("ana").email("ana@gmail.com").senha("x").build();
    private final Usuario jogador2 = Usuario.builder().id(2L).username("bob").email("bob@gmail.com").senha("x").build();

    @Test
    @DisplayName("deve criar jogo com builder e valores padrão")
    void criarJogoComBuilder() {
        Jogo jogo = Jogo.builder()
                .jogador1(jogador1)
                .status("AGUARDANDO")
                .token("ABC123")
                .build();

        assertThat(jogo.getJogador1()).isEqualTo(jogador1);
        assertThat(jogo.getJogador2()).isNull();
        assertThat(jogo.getStatus()).isEqualTo("AGUARDANDO");
        assertThat(jogo.getToken()).isEqualTo("ABC123");
        assertThat(jogo.getModo()).isEqualTo("PADRAO");
        assertThat(jogo.isJogador1Pronto()).isFalse();
        assertThat(jogo.isJogador2Pronto()).isFalse();
        assertThat(jogo.getVencedor()).isNull();
        assertThat(jogo.getTurnoAtual()).isNull();
    }

    @Test
    @DisplayName("deve permitir definir jogador2")
    void definirJogador2() {
        Jogo jogo = Jogo.builder().jogador1(jogador1).status("AGUARDANDO").build();

        jogo.setJogador2(jogador2);
        jogo.setStatus("POSICIONANDO");

        assertThat(jogo.getJogador2()).isEqualTo(jogador2);
        assertThat(jogo.getStatus()).isEqualTo("POSICIONANDO");
    }

    @Test
    @DisplayName("deve marcar jogadores como prontos")
    void marcarProntos() {
        Jogo jogo = Jogo.builder()
                .jogador1(jogador1).jogador2(jogador2)
                .status("POSICIONANDO")
                .jogador1Pronto(false).jogador2Pronto(false)
                .build();

        jogo.setJogador1Pronto(true);
        assertThat(jogo.isJogador1Pronto()).isTrue();
        assertThat(jogo.isJogador2Pronto()).isFalse();

        jogo.setJogador2Pronto(true);
        assertThat(jogo.isJogador2Pronto()).isTrue();
    }

    @Test
    @DisplayName("deve definir vencedor e status FINALIZADO")
    void definirVencedor() {
        Jogo jogo = Jogo.builder()
                .jogador1(jogador1).jogador2(jogador2)
                .status("JOGANDO").turnoAtual(jogador1)
                .build();

        jogo.setStatus("FINALIZADO");
        jogo.setVencedor(jogador1);

        assertThat(jogo.getStatus()).isEqualTo("FINALIZADO");
        assertThat(jogo.getVencedor()).isEqualTo(jogador1);
    }

    @Test
    @DisplayName("deve armazenar skins dos jogadores")
    void armazenarSkins() {
        Jogo jogo = Jogo.builder()
                .jogador1(jogador1)
                .skinJogador1("pirata")
                .status("AGUARDANDO")
                .build();

        assertThat(jogo.getSkinJogador1()).isEqualTo("pirata");
        assertThat(jogo.getSkinJogador2()).isNull();

        jogo.setSkinJogador2("naval");
        assertThat(jogo.getSkinJogador2()).isEqualTo("naval");
    }

    @Test
    @DisplayName("deve suportar modo EXPLOSAO")
    void modoExplosao() {
        Jogo jogo = Jogo.builder()
                .jogador1(jogador1)
                .status("AGUARDANDO")
                .modo("EXPLOSAO")
                .build();

        assertThat(jogo.getModo()).isEqualTo("EXPLOSAO");
    }

    @Test
    @DisplayName("deve armazenar dados de revanche")
    void dadosRevanche() {
        Jogo jogo = Jogo.builder()
                .jogador1(jogador1).jogador2(jogador2)
                .status("FINALIZADO").vencedor(jogador1)
                .build();

        jogo.setRevancheSolicitante("ana");
        jogo.setRevancheModo("EXPLOSAO");
        jogo.setRevancheJogoId(42L);

        assertThat(jogo.getRevancheSolicitante()).isEqualTo("ana");
        assertThat(jogo.getRevancheModo()).isEqualTo("EXPLOSAO");
        assertThat(jogo.getRevancheJogoId()).isEqualTo(42L);
    }

    @Test
    @DisplayName("deve ter token único")
    void tokenUnico() {
        Jogo jogo1 = Jogo.builder().jogador1(jogador1).status("AGUARDANDO").token("AAA111").build();
        Jogo jogo2 = Jogo.builder().jogador1(jogador2).status("AGUARDANDO").token("BBB222").build();

        assertThat(jogo1.getToken()).isNotEqualTo(jogo2.getToken());
    }
}
