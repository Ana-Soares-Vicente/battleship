package com.ana.battleship;

import com.ana.battleship.config.BusinessMetrics;
import com.ana.battleship.config.RedisWebSocketRelay.WebSocketBroadcaster;
import com.ana.battleship.model.*;
import com.ana.battleship.repository.*;
import com.ana.battleship.service.JogoService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class JogoServiceTest {

    @Mock private JogoRepository jogoRepo;
    @Mock private TabuleiroRepository tabuleiroRepo;
    @Mock private NavioRepository navioRepo;
    @Mock private TiroRepository tiroRepo;
    @Mock private UsuarioRepository usuarioRepo;
    @Mock private WebSocketBroadcaster messagingTemplate;
    @Mock private EntityManager entityManager;
    @Mock private BusinessMetrics businessMetrics;

    private JogoService jogoService;

    private Usuario jogador1;
    private Usuario jogador2;

    @BeforeEach
    void setUp() {
        jogoService = new JogoService(jogoRepo, tabuleiroRepo, navioRepo, tiroRepo, usuarioRepo, messagingTemplate, entityManager, businessMetrics);

        jogador1 = Usuario.builder().id(1L).username("ana").email("ana@gmail.com").senha("x").build();
        jogador2 = Usuario.builder().id(2L).username("bob").email("bob@gmail.com").senha("x").build();
    }

    @Nested
    @DisplayName("Criar Jogo")
    class CriarJogo {

        @Test
        @DisplayName("deve criar jogo com status AGUARDANDO")
        void criarJogoComSucesso() {
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findByStatusAndJogador1("AGUARDANDO", jogador1)).thenReturn(List.of());
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> {
                Jogo j = inv.getArgument(0);
                j.setId(1L);
                return j;
            });
            when(tabuleiroRepo.save(any(Tabuleiro.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(
                    Jogo.builder().id(1L).jogador1(jogador1).status("AGUARDANDO").token("ABC123").modo("PADRAO").build()
            ));

            Jogo jogo = jogoService.criarJogo("ana", "pirata", "PADRAO");

            assertThat(jogo.getStatus()).isEqualTo("AGUARDANDO");
            assertThat(jogo.getJogador1()).isEqualTo(jogador1);
            assertThat(jogo.getModo()).isEqualTo("PADRAO");

            verify(tabuleiroRepo).save(any(Tabuleiro.class));
            verify(messagingTemplate).broadcast(eq("/topic/lobby"), any(Object.class));
        }

        @Test
        @DisplayName("deve expirar salas anteriores do mesmo jogador")
        void expirarSalasAnteriores() {
            Jogo salaAntiga = Jogo.builder().id(99L).jogador1(jogador1).status("AGUARDANDO").build();
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findByStatusAndJogador1("AGUARDANDO", jogador1)).thenReturn(List.of(salaAntiga));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> {
                Jogo j = inv.getArgument(0);
                if (j.getId() == null) j.setId(2L);
                return j;
            });
            when(tabuleiroRepo.save(any(Tabuleiro.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jogoRepo.findById(2L)).thenReturn(Optional.of(
                    Jogo.builder().id(2L).jogador1(jogador1).status("AGUARDANDO").token("XYZ789").modo("PADRAO").build()
            ));

            jogoService.criarJogo("ana", null, "PADRAO");

            assertThat(salaAntiga.getStatus()).isEqualTo("EXPIRADO");
        }

        @Test
        @DisplayName("deve usar modo PADRAO quando modo é null")
        void modoPadraoQuandoNull() {
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findByStatusAndJogador1("AGUARDANDO", jogador1)).thenReturn(List.of());
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> {
                Jogo j = inv.getArgument(0);
                j.setId(1L);
                return j;
            });
            when(tabuleiroRepo.save(any(Tabuleiro.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(
                    Jogo.builder().id(1L).jogador1(jogador1).status("AGUARDANDO").token("AAA111").modo("PADRAO").build()
            ));

            Jogo jogo = jogoService.criarJogo("ana", null, null);

            ArgumentCaptor<Jogo> captor = ArgumentCaptor.forClass(Jogo.class);
            verify(jogoRepo, atLeastOnce()).save(captor.capture());
            Jogo salvo = captor.getAllValues().stream()
                    .filter(j -> j.getJogador1() != null && j.getJogador1().equals(jogador1) && "AGUARDANDO".equals(j.getStatus()))
                    .findFirst().orElse(null);
            assertThat(salvo).isNotNull();
            assertThat(salvo.getModo()).isEqualTo("PADRAO");
        }
    }

    @Nested
    @DisplayName("Entrar no Jogo")
    class EntrarNoJogo {

        @Test
        @DisplayName("deve permitir jogador2 entrar no jogo")
        void entrarComSucesso() {
            Jogo jogo = Jogo.builder().id(1L).jogador1(jogador1).status("AGUARDANDO").token("ABC123").modo("PADRAO").build();

            when(usuarioRepo.findByUsername("bob")).thenReturn(Optional.of(jogador2));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogo));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> inv.getArgument(0));
            when(tabuleiroRepo.save(any(Tabuleiro.class))).thenAnswer(inv -> inv.getArgument(0));

            Jogo result = jogoService.entrarNoJogo(1L, "bob", "naval");

            assertThat(result.getStatus()).isEqualTo("POSICIONANDO");
            assertThat(result.getJogador2()).isEqualTo(jogador2);
            assertThat(result.getSkinJogador2()).isEqualTo("naval");
            verify(messagingTemplate).broadcast(eq("/topic/jogo/1"), any(Object.class));
            verify(messagingTemplate).broadcast(eq("/topic/lobby"), any(Object.class));
        }

        @Test
        @DisplayName("deve rejeitar se jogo não está AGUARDANDO")
        void rejeitarJogoNaoAguardando() {
            Jogo jogo = Jogo.builder().id(1L).jogador1(jogador1).status("JOGANDO").build();

            when(usuarioRepo.findByUsername("bob")).thenReturn(Optional.of(jogador2));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogo));

            assertThatThrownBy(() -> jogoService.entrarNoJogo(1L, "bob", null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("não está disponível");
        }

        @Test
        @DisplayName("deve rejeitar se jogador tenta entrar no próprio jogo")
        void rejeitarProprioJogo() {
            Jogo jogo = Jogo.builder().id(1L).jogador1(jogador1).status("AGUARDANDO").build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogo));

            assertThatThrownBy(() -> jogoService.entrarNoJogo(1L, "ana", null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("próprio jogo");
        }
    }

    @Nested
    @DisplayName("Posicionar Navios")
    class PosicionarNavios {

        private Jogo jogoEmPosicionamento;
        private Tabuleiro tabuleiro;

        @BeforeEach
        void setUp() {
            jogoEmPosicionamento = Jogo.builder()
                    .id(1L).jogador1(jogador1).jogador2(jogador2)
                    .status("POSICIONANDO").modo("PADRAO")
                    .jogador1Pronto(false).jogador2Pronto(false)
                    .build();
            tabuleiro = Tabuleiro.builder().id(1L).jogo(jogoEmPosicionamento).dono(jogador1).build();
        }

        private List<Map<String, Object>> naviosValidos() {
            List<Map<String, Object>> navios = new ArrayList<>();
            navios.add(Map.of("tipo", "PORTA_AVIOES", "linhaInicial", 0, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "ENCOURACADO", "linhaInicial", 1, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "CRUZADOR", "linhaInicial", 2, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "SUBMARINO", "linhaInicial", 3, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "DESTROIER", "linhaInicial", 4, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            return navios;
        }

        @Test
        @DisplayName("deve posicionar 5 navios válidos")
        void posicionarComSucesso() {
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L))
                    .thenReturn(Optional.of(jogoEmPosicionamento))  // primeira chamada (buscarJogo)
                    .thenReturn(Optional.of(  // segunda chamada (após flush/clear)
                            Jogo.builder().id(1L).jogador1(jogador1).jogador2(jogador2)
                                    .status("POSICIONANDO").modo("PADRAO")
                                    .jogador1Pronto(true).jogador2Pronto(false).build()
                    ));
            when(tabuleiroRepo.findByJogoAndDono(any(Jogo.class), eq(jogador1))).thenReturn(Optional.of(tabuleiro));
            when(navioRepo.findByTabuleiro(tabuleiro)).thenReturn(List.of());
            when(navioRepo.save(any(Navio.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> inv.getArgument(0));

            assertThatNoException().isThrownBy(() ->
                    jogoService.posicionarNavios(1L, "ana", naviosValidos()));

            verify(navioRepo, times(5)).save(any(Navio.class));
            verify(jogoRepo).marcarJogador1Pronto(1L);
        }

        @Test
        @DisplayName("deve rejeitar se não tem 5 navios")
        void rejeitarQuantidadeErrada() {
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmPosicionamento));
            when(tabuleiroRepo.findByJogoAndDono(any(Jogo.class), eq(jogador1))).thenReturn(Optional.of(tabuleiro));
            when(navioRepo.findByTabuleiro(tabuleiro)).thenReturn(List.of());

            List<Map<String, Object>> navios = naviosValidos().subList(0, 3);

            assertThatThrownBy(() -> jogoService.posicionarNavios(1L, "ana", navios))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("5 navios");
        }

        @Test
        @DisplayName("deve rejeitar navio fora do tabuleiro")
        void rejeitarNavioForaDoBoardeiro() {
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmPosicionamento));
            when(tabuleiroRepo.findByJogoAndDono(any(Jogo.class), eq(jogador1))).thenReturn(Optional.of(tabuleiro));
            when(navioRepo.findByTabuleiro(tabuleiro)).thenReturn(List.of());

            List<Map<String, Object>> navios = new ArrayList<>();
            navios.add(Map.of("tipo", "PORTA_AVIOES", "linhaInicial", 0, "colunaInicial", 8, "direcao", "HORIZONTAL")); // sai do tabuleiro
            navios.add(Map.of("tipo", "ENCOURACADO", "linhaInicial", 1, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "CRUZADOR", "linhaInicial", 2, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "SUBMARINO", "linhaInicial", 3, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "DESTROIER", "linhaInicial", 4, "colunaInicial", 0, "direcao", "HORIZONTAL"));

            assertThatThrownBy(() -> jogoService.posicionarNavios(1L, "ana", navios))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("fora do tabuleiro");
        }

        @Test
        @DisplayName("deve rejeitar navios sobrepostos")
        void rejeitarNaviosSobrepostos() {
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmPosicionamento));
            when(tabuleiroRepo.findByJogoAndDono(any(Jogo.class), eq(jogador1))).thenReturn(Optional.of(tabuleiro));
            when(navioRepo.findByTabuleiro(tabuleiro)).thenReturn(List.of());

            List<Map<String, Object>> navios = new ArrayList<>();
            navios.add(Map.of("tipo", "PORTA_AVIOES", "linhaInicial", 0, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "ENCOURACADO", "linhaInicial", 0, "colunaInicial", 0, "direcao", "HORIZONTAL")); // sobreposto!
            navios.add(Map.of("tipo", "CRUZADOR", "linhaInicial", 2, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "SUBMARINO", "linhaInicial", 3, "colunaInicial", 0, "direcao", "HORIZONTAL"));
            navios.add(Map.of("tipo", "DESTROIER", "linhaInicial", 4, "colunaInicial", 0, "direcao", "HORIZONTAL"));

            assertThatThrownBy(() -> jogoService.posicionarNavios(1L, "ana", navios))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("sobrepostos");
        }

        @Test
        @DisplayName("deve rejeitar se jogo não está em POSICIONANDO")
        void rejeitarStatusErrado() {
            Jogo jogoJogando = Jogo.builder().id(1L).jogador1(jogador1).jogador2(jogador2).status("JOGANDO").build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoJogando));

            assertThatThrownBy(() -> jogoService.posicionarNavios(1L, "ana", naviosValidos()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("posicionamento");
        }
    }

    @Nested
    @DisplayName("Atirar")
    class Atirar {

        private Jogo jogoEmAndamento;
        private Tabuleiro tabuleiroOponente;

        @BeforeEach
        void setUp() {
            jogoEmAndamento = Jogo.builder()
                    .id(1L).jogador1(jogador1).jogador2(jogador2)
                    .status("JOGANDO").turnoAtual(jogador1).modo("PADRAO")
                    .build();
            tabuleiroOponente = Tabuleiro.builder().id(2L).jogo(jogoEmAndamento).dono(jogador2).build();
        }

        @Test
        @DisplayName("deve registrar tiro na água")
        void tiroNaAgua() {
            Navio navio = Navio.builder().tipo("DESTROIER").tamanho(2)
                    .linhaInicial(5).colunaInicial(5).direcao("HORIZONTAL").acertos(0).build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmAndamento));
            when(tiroRepo.existsByJogoAndAtiradorAndLinhaAndColuna(jogoEmAndamento, jogador1, 0, 0)).thenReturn(false);
            when(tabuleiroRepo.findByJogoAndDono(jogoEmAndamento, jogador2)).thenReturn(Optional.of(tabuleiroOponente));
            when(navioRepo.findByTabuleiro(tabuleiroOponente)).thenReturn(List.of(navio));
            when(tiroRepo.save(any(Tiro.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> result = jogoService.atirar(1L, "ana", 0, 0);

            assertThat(result.get("resultado")).isEqualTo("AGUA");
            assertThat(result.get("fimDeJogo")).isEqualTo(false);
            // Turno passa para o oponente
            assertThat(result.get("turnoAtual")).isEqualTo("bob");
        }

        @Test
        @DisplayName("deve registrar acerto em navio")
        void tiroComAcerto() {
            Navio navio = Navio.builder().tipo("DESTROIER").tamanho(2)
                    .linhaInicial(0).colunaInicial(0).direcao("HORIZONTAL").acertos(0).build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmAndamento));
            when(tiroRepo.existsByJogoAndAtiradorAndLinhaAndColuna(jogoEmAndamento, jogador1, 0, 0)).thenReturn(false);
            when(tabuleiroRepo.findByJogoAndDono(jogoEmAndamento, jogador2)).thenReturn(Optional.of(tabuleiroOponente));
            when(navioRepo.findByTabuleiro(tabuleiroOponente)).thenReturn(List.of(navio));
            when(navioRepo.save(any(Navio.class))).thenAnswer(inv -> inv.getArgument(0));
            when(tiroRepo.save(any(Tiro.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> result = jogoService.atirar(1L, "ana", 0, 0);

            assertThat(result.get("resultado")).isEqualTo("ACERTO");
            // Turno permanece com o atirador
            assertThat(result.get("turnoAtual")).isEqualTo("ana");
        }

        @Test
        @DisplayName("deve afundar navio quando todos os segmentos são acertados")
        void tiroAfunda() {
            Navio navio = Navio.builder().tipo("DESTROIER").tamanho(2)
                    .linhaInicial(0).colunaInicial(0).direcao("HORIZONTAL").acertos(1).build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmAndamento));
            when(tiroRepo.existsByJogoAndAtiradorAndLinhaAndColuna(jogoEmAndamento, jogador1, 0, 1)).thenReturn(false);
            when(tabuleiroRepo.findByJogoAndDono(jogoEmAndamento, jogador2)).thenReturn(Optional.of(tabuleiroOponente));
            when(navioRepo.findByTabuleiro(tabuleiroOponente)).thenReturn(List.of(navio));
            when(navioRepo.save(any(Navio.class))).thenAnswer(inv -> inv.getArgument(0));
            when(tiroRepo.save(any(Tiro.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> result = jogoService.atirar(1L, "ana", 0, 1);

            assertThat(result.get("resultado")).isEqualTo("AFUNDOU");
            assertThat(result.get("tipoAfundado")).isEqualTo("DESTROIER");
            // Único navio afundado = fim de jogo
            assertThat(result.get("fimDeJogo")).isEqualTo(true);
            assertThat(result.get("vencedor")).isEqualTo("ana");
        }

        @Test
        @DisplayName("deve rejeitar se não é o turno do jogador")
        void rejeitarForaDeTurno() {
            when(usuarioRepo.findByUsername("bob")).thenReturn(Optional.of(jogador2));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmAndamento));

            assertThatThrownBy(() -> jogoService.atirar(1L, "bob", 0, 0))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Não é seu turno");
        }

        @Test
        @DisplayName("deve rejeitar tiro repetido na mesma posição")
        void rejeitarTiroRepetido() {
            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoEmAndamento));
            when(tiroRepo.existsByJogoAndAtiradorAndLinhaAndColuna(jogoEmAndamento, jogador1, 3, 3)).thenReturn(true);

            assertThatThrownBy(() -> jogoService.atirar(1L, "ana", 3, 3))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Já atirou");
        }

        @Test
        @DisplayName("deve rejeitar se jogo não está em andamento")
        void rejeitarJogoNaoEmAndamento() {
            Jogo jogoFinalizado = Jogo.builder().id(1L).jogador1(jogador1).jogador2(jogador2)
                    .status("FINALIZADO").turnoAtual(jogador1).build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogoFinalizado));

            assertThatThrownBy(() -> jogoService.atirar(1L, "ana", 0, 0))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("não está em andamento");
        }
    }

    @Nested
    @DisplayName("Abandonar Partida")
    class AbandonarPartida {

        @Test
        @DisplayName("deve abandonar jogo AGUARDANDO como EXPIRADO")
        void abandonarAguardando() {
            Jogo jogo = Jogo.builder().id(1L).jogador1(jogador1).status("AGUARDANDO").build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogo));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> inv.getArgument(0));

            jogoService.abandonarPartidaPorId(1L, "ana");

            assertThat(jogo.getStatus()).isEqualTo("EXPIRADO");
        }

        @Test
        @DisplayName("deve dar vitória ao oponente quando abandona jogo em andamento")
        void abandonarJogando() {
            Jogo jogo = Jogo.builder().id(1L).jogador1(jogador1).jogador2(jogador2)
                    .status("JOGANDO").turnoAtual(jogador1).build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogo));
            when(jogoRepo.save(any(Jogo.class))).thenAnswer(inv -> inv.getArgument(0));

            jogoService.abandonarPartidaPorId(1L, "ana");

            assertThat(jogo.getStatus()).isEqualTo("FINALIZADO");
            assertThat(jogo.getVencedor()).isEqualTo(jogador2);
            verify(messagingTemplate).broadcast(eq("/topic/jogo/1"), any(Object.class));
        }

        @Test
        @DisplayName("não deve fazer nada se jogo já está finalizado")
        void ignorarJogoFinalizado() {
            Jogo jogo = Jogo.builder().id(1L).jogador1(jogador1).jogador2(jogador2)
                    .status("FINALIZADO").vencedor(jogador2).build();

            when(usuarioRepo.findByUsername("ana")).thenReturn(Optional.of(jogador1));
            when(jogoRepo.findById(1L)).thenReturn(Optional.of(jogo));

            jogoService.abandonarPartidaPorId(1L, "ana");

            verify(jogoRepo, never()).save(any());
        }
    }
}
