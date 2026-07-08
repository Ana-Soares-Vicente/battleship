package com.ana.battleship;

import com.ana.battleship.model.Navio;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class NavioTest {

    @Test
    void ocupa_horizontal() {
        Navio navio = Navio.builder().tipo("CRUZADOR").tamanho(3)
                .linhaInicial(2).colunaInicial(3).direcao("HORIZONTAL").acertos(0).build();

        assertThat(navio.ocupa(2, 3)).isTrue();
        assertThat(navio.ocupa(2, 4)).isTrue();
        assertThat(navio.ocupa(2, 5)).isTrue();
        assertThat(navio.ocupa(2, 6)).isFalse();
        assertThat(navio.ocupa(3, 3)).isFalse();
    }

    @Test
    void ocupa_vertical() {
        Navio navio = Navio.builder().tipo("ENCOURACADO").tamanho(4)
                .linhaInicial(0).colunaInicial(5).direcao("VERTICAL").acertos(0).build();

        assertThat(navio.ocupa(0, 5)).isTrue();
        assertThat(navio.ocupa(3, 5)).isTrue();
        assertThat(navio.ocupa(4, 5)).isFalse();
    }

    @Test
    void estaAfundado_quando_acertos_igual_tamanho() {
        Navio navio = Navio.builder().tipo("DESTROIER").tamanho(2).acertos(2).build();
        assertThat(navio.estaAfundado()).isTrue();
    }

    @Test
    void naoAfundado_quando_acertos_menor_que_tamanho() {
        Navio navio = Navio.builder().tipo("PORTA_AVIOES").tamanho(5).acertos(4).build();
        assertThat(navio.estaAfundado()).isFalse();
    }
}
