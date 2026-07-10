package com.ana.battleship.service;

import com.ana.battleship.model.*;
import com.ana.battleship.repository.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class JogoService {

    private final JogoRepository jogoRepo;
    private final TabuleiroRepository tabuleiroRepo;
    private final NavioRepository navioRepo;
    private final TiroRepository tiroRepo;
    private final UsuarioRepository usuarioRepo;
    private final SimpMessagingTemplate messagingTemplate;
    private final EntityManager entityManager;

    // Frota padrão: tipo -> tamanho
    private static final Map<String, Integer> FROTA = Map.of(
        "PORTA_AVIOES", 5, "ENCOURACADO", 4, "CRUZADOR", 3, "SUBMARINO", 3, "DESTROIER", 2
    );

    private void atualizarAtividade(Jogo jogo) {
        jogo.setUltimaAtividade(Instant.now());
        jogoRepo.save(jogo);
    }

    @Transactional
    public Jogo criarJogo(String username, String skin, String modo) {
        Usuario jogador = buscarUsuario(username);

        // Cancelar salas anteriores AGUARDANDO deste jogador
        List<Jogo> salasAnteriores = jogoRepo.findByStatusAndJogador1("AGUARDANDO", jogador);
        for (Jogo antiga : salasAnteriores) {
            antiga.setStatus("EXPIRADO");
            jogoRepo.save(antiga);
        }

        String token = gerarToken();
        Jogo jogo = Jogo.builder().jogador1(jogador).status("AGUARDANDO").token(token).skinJogador1(skin).modo(modo != null ? modo : "PADRAO").build();
        jogo = jogoRepo.save(jogo);
        tabuleiroRepo.save(Tabuleiro.builder().jogo(jogo).dono(jogador).build());

        Map<String, Object> evento = new HashMap<>();
        evento.put("tipo", "NOVO_JOGO");
        evento.put("id", jogo.getId());
        evento.put("jogador1", jogador.getUsername());
        messagingTemplate.convertAndSend("/topic/lobby", (Object) evento);

        return jogo;
    }

    @Transactional
    public Jogo entrarPorToken(String token, String username, String skin) {
        Jogo jogo = jogoRepo.findByToken(token.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Token inválido ou jogo não encontrado"));
        if (!jogo.getStatus().equals("AGUARDANDO")) {
            throw new IllegalStateException("Jogo não está disponível");
        }
        Instant threshold = Instant.now().minusSeconds(120); // 2 min
        if (jogo.getUltimaAtividade() != null && jogo.getUltimaAtividade().isBefore(threshold)) {
            throw new IllegalStateException("Sala expirada");
        }
        return entrarNoJogo(jogo.getId(), username, skin);
    }

    private String gerarToken() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    @Transactional
    public Jogo entrarNoJogo(Long jogoId, String username, String skin) {
        Usuario jogador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);

        if (!jogo.getStatus().equals("AGUARDANDO"))
            throw new IllegalStateException("Jogo não está disponível");
        if (jogo.getJogador1().getId().equals(jogador.getId()))
            throw new IllegalArgumentException("Não pode entrar no próprio jogo");

        jogo.setJogador2(jogador);
        jogo.setSkinJogador2(skin);
        jogo.setStatus("POSICIONANDO");
        tabuleiroRepo.save(Tabuleiro.builder().jogo(jogo).dono(jogador).build());
        jogo = jogoRepo.save(jogo);

        atualizarAtividade(jogo);

        Map<String, Object> evento = new HashMap<>();
        evento.put("tipo", "JOGADOR_ENTROU");
        evento.put("jogador2", jogador.getUsername());
        evento.put("skinJogador2", skin);
        evento.put("status", jogo.getStatus());
        messagingTemplate.convertAndSend("/topic/jogo/" + jogoId, (Object) evento);

        Map<String, Object> eventoLobby = new HashMap<>();
        eventoLobby.put("tipo", "JOGO_REMOVIDO");
        eventoLobby.put("id", jogoId);
        messagingTemplate.convertAndSend("/topic/lobby", (Object) eventoLobby);

        return jogo;
    }

    @Transactional
    public void posicionarNavios(Long jogoId, String username, List<Map<String, Object>> navios) {
        Usuario jogador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);

        if (!jogo.getStatus().equals("POSICIONANDO"))
            throw new IllegalStateException("Não está na fase de posicionamento");

        Tabuleiro tabuleiro = tabuleiroRepo.findByJogoAndDono(jogo, jogador)
                .orElseThrow(() -> new IllegalArgumentException("Você não está neste jogo"));

        if (navios.size() != 5) throw new IllegalArgumentException("Deve ter 5 navios");

        Set<String> tipos = new HashSet<>();
        boolean[][] grade = new boolean[10][10];

        navioRepo.deleteAll(navioRepo.findByTabuleiro(tabuleiro));

        for (Map<String, Object> n : navios) {
            String tipo = (String) n.get("tipo");
            int linhaInicial = (int) n.get("linhaInicial");
            int colunaInicial = (int) n.get("colunaInicial");
            String direcao = (String) n.get("direcao");
            int tamanho = FROTA.getOrDefault(tipo, 0);

            if (tamanho == 0) throw new IllegalArgumentException("Tipo inválido: " + tipo);
            if (!tipos.add(tipo) && !tipo.equals("CRUZADOR") && !tipo.equals("SUBMARINO"))
                throw new IllegalArgumentException("Tipo duplicado: " + tipo);

            for (int i = 0; i < tamanho; i++) {
                int l = direcao.equals("VERTICAL") ? linhaInicial + i : linhaInicial;
                int c = direcao.equals("HORIZONTAL") ? colunaInicial + i : colunaInicial;
                if (l < 0 || l >= 10 || c < 0 || c >= 10)
                    throw new IllegalArgumentException(tipo + " fora do tabuleiro");
                if (grade[l][c])
                    throw new IllegalArgumentException("Navios sobrepostos");
                grade[l][c] = true;
            }

            navioRepo.save(Navio.builder()
                    .tabuleiro(tabuleiro).tipo(tipo).tamanho(tamanho)
                    .linhaInicial(linhaInicial).colunaInicial(colunaInicial)
                    .direcao(direcao).acertos(0).build());
        }

        boolean isJogador1 = jogo.getJogador1().getId().equals(jogador.getId());

        entityManager.flush();
        entityManager.clear();

        if (isJogador1) {
            jogoRepo.marcarJogador1Pronto(jogoId);
        } else {
            jogoRepo.marcarJogador2Pronto(jogoId);
        }

        entityManager.flush();
        entityManager.clear();
        jogo = jogoRepo.findById(jogoId).orElseThrow();

        System.out.println(">>> JOGO #" + jogoId + " | jogador=" + jogador.getUsername()
                + " | isJ1=" + isJogador1
                + " | j1Pronto=" + jogo.isJogador1Pronto()
                + " | j2Pronto=" + jogo.isJogador2Pronto());

        if (jogo.isJogador1Pronto() && jogo.isJogador2Pronto()) {
            jogo.setStatus("JOGANDO");
            jogo.setTurnoAtual(jogo.getJogador1());
            System.out.println(">>> JOGO #" + jogoId + " MUDOU PARA JOGANDO!");
        }
        jogoRepo.save(jogo);

        atualizarAtividade(jogo);

        Map<String, Object> evento = new HashMap<>();
        evento.put("tipo", "JOGADOR_PRONTO");
        evento.put("jogador", jogador.getUsername());
        evento.put("status", jogo.getStatus());
        if (jogo.getStatus().equals("JOGANDO")) {
            evento.put("turnoAtual", jogo.getTurnoAtual().getUsername());
        }
        messagingTemplate.convertAndSend("/topic/jogo/" + jogoId, (Object) evento);
    }


    @Transactional
    public Map<String, Object> atirar(Long jogoId, String username, int linha, int coluna) {
        long t0 = System.currentTimeMillis();
        System.out.println("[ATAQUE RECEBIDO] jogador=" + username + " jogo=" + jogoId + " pos=" + linha + "," + coluna + " ts=" + t0);

        Usuario atirador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);

        if (!jogo.getStatus().equals("JOGANDO"))
            throw new IllegalStateException("Jogo não está em andamento");
        if (!jogo.getTurnoAtual().getId().equals(atirador.getId()))
            throw new IllegalStateException("Não é seu turno");
        if (tiroRepo.existsByJogoAndAtiradorAndLinhaAndColuna(jogo, atirador, linha, coluna))
            throw new IllegalArgumentException("Já atirou aqui");

        Usuario oponente = jogo.getJogador1().getId().equals(atirador.getId())
                ? jogo.getJogador2() : jogo.getJogador1();
        Tabuleiro tabuleiroOponente = tabuleiroRepo.findByJogoAndDono(jogo, oponente).orElseThrow();
        List<Navio> navios = navioRepo.findByTabuleiro(tabuleiroOponente);

        Navio atingido = navios.stream().filter(n -> n.ocupa(linha, coluna)).findFirst().orElse(null);

        String resultado;
        String tipoAfundado = null;

        if (atingido == null) {
            resultado = "AGUA";
        } else {
            atingido.setAcertos(atingido.getAcertos() + 1);
            navioRepo.save(atingido);
            if (atingido.estaAfundado()) {
                resultado = "AFUNDOU";
                tipoAfundado = atingido.getTipo();
            } else {
                resultado = "ACERTO";
            }
        }

        tiroRepo.save(Tiro.builder()
                .jogo(jogo).atirador(atirador)
                .linha(linha).coluna(coluna)
                .resultado(resultado).tipoNavioAfundado(tipoAfundado).build());

        boolean fimDeJogo = navios.stream().allMatch(Navio::estaAfundado);
        if (fimDeJogo) {
            jogo.setStatus("FINALIZADO");
            jogo.setVencedor(atirador);
        } else if (resultado.equals("AGUA")) {
            // Só troca turno se errou — acertou ou afundou continua jogando
            jogo.setTurnoAtual(oponente);
        }
        // Se ACERTO ou AFUNDOU, turno permanece com o atirador
        jogo.setUltimaAtividade(Instant.now());
        jogoRepo.save(jogo);

        long t1 = System.currentTimeMillis();
        System.out.println("[ATAQUE PROCESSADO] resultado=" + resultado + " tempo_db=" + (t1 - t0) + "ms");

        // turnoAtual na resposta: se acertou, continua sendo o atirador
        String proximoTurno = fimDeJogo ? null :
                resultado.equals("AGUA") ? oponente.getUsername() : atirador.getUsername();

        Map<String, Object> resposta = new HashMap<>();
        resposta.put("linha", linha);
        resposta.put("coluna", coluna);
        resposta.put("resultado", resultado);
        resposta.put("tipoAfundado", tipoAfundado);
        resposta.put("fimDeJogo", fimDeJogo);
        resposta.put("vencedor", fimDeJogo ? atirador.getUsername() : null);
        resposta.put("turnoAtual", proximoTurno);

        Map<String, Object> navioAfundadoInfo = null;
        if (resultado.equals("AFUNDOU") && atingido != null) {
            navioAfundadoInfo = new HashMap<>();
            navioAfundadoInfo.put("tipo", atingido.getTipo());
            navioAfundadoInfo.put("tamanho", atingido.getTamanho());
            navioAfundadoInfo.put("linhaInicial", atingido.getLinhaInicial());
            navioAfundadoInfo.put("colunaInicial", atingido.getColunaInicial());
            navioAfundadoInfo.put("direcao", atingido.getDirecao());
            resposta.put("navioAfundado", navioAfundadoInfo);
        }

        Map<String, Object> evento = new HashMap<>();
        evento.put("tipo", "TIRO");
        evento.put("atirador", atirador.getUsername());
        evento.put("linha", linha);
        evento.put("coluna", coluna);
        evento.put("resultado", resultado);
        evento.put("tipoAfundado", tipoAfundado);
        evento.put("navioAfundado", navioAfundadoInfo);
        evento.put("fimDeJogo", fimDeJogo);
        evento.put("vencedor", fimDeJogo ? atirador.getUsername() : null);
        evento.put("turnoAtual", proximoTurno);
        messagingTemplate.convertAndSend("/topic/jogo/" + jogoId, (Object) evento);

        long t2 = System.currentTimeMillis();
        System.out.println("[WEBSOCKET ENVIADO] tempo_ws=" + (t2 - t1) + "ms | tempo_total=" + (t2 - t0) + "ms");

        return resposta;
    }


    @Transactional(readOnly = true)
    public Map<String, Object> getEstadoJogo(Long jogoId, String username) {
        Usuario jogador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);
        validarJogadorNoJogo(jogo, jogador);

        Map<String, Object> r = new HashMap<>();
        r.put("id", jogo.getId());
        r.put("token", jogo.getToken());
        r.put("jogador1", jogo.getJogador1().getUsername());
        r.put("jogador2", jogo.getJogador2() != null ? jogo.getJogador2().getUsername() : null);
        r.put("status", jogo.getStatus());
        r.put("turnoAtual", jogo.getTurnoAtual() != null ? jogo.getTurnoAtual().getUsername() : null);
        r.put("vencedor", jogo.getVencedor() != null ? jogo.getVencedor().getUsername() : null);
        r.put("meusProntos", ehJogador1(jogo, jogador) ? jogo.isJogador1Pronto() : jogo.isJogador2Pronto());
        r.put("skinJogador1", jogo.getSkinJogador1());
        r.put("skinJogador2", jogo.getSkinJogador2());
        r.put("modo", jogo.getModo());
        return r;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getEstadoJogoInterno(Long jogoId) {
        Jogo jogo = buscarJogo(jogoId);
        Map<String, Object> r = new HashMap<>();
        r.put("id", jogo.getId());
        r.put("token", jogo.getToken());
        r.put("jogador1", jogo.getJogador1().getUsername());
        r.put("jogador2", jogo.getJogador2() != null ? jogo.getJogador2().getUsername() : null);
        r.put("status", jogo.getStatus());
        r.put("turnoAtual", jogo.getTurnoAtual() != null ? jogo.getTurnoAtual().getUsername() : null);
        r.put("vencedor", jogo.getVencedor() != null ? jogo.getVencedor().getUsername() : null);
        r.put("skinJogador1", jogo.getSkinJogador1());
        r.put("skinJogador2", jogo.getSkinJogador2());
        r.put("modo", jogo.getModo());
        return r;
    }

    private boolean ehJogador1(Jogo jogo, Usuario jogador) {
        return jogo.getJogador1().getId().equals(jogador.getId());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMeusTiros(Long jogoId, String username) {
        Usuario usuario = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);
        return tiroRepo.findByJogoAndAtirador(jogo, usuario).stream().map(t -> {
            Map<String, Object> m = new HashMap<>();
            m.put("linha", t.getLinha());
            m.put("coluna", t.getColuna());
            m.put("resultado", t.getResultado());
            m.put("tipoAfundado", t.getTipoNavioAfundado());
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMinhaFrota(Long jogoId, String username) {
        Usuario jogador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);
        validarJogadorNoJogo(jogo, jogador);

        Tabuleiro tabuleiro = tabuleiroRepo.findByJogoAndDono(jogo, jogador)
                .orElseThrow(() -> new IllegalArgumentException("Tabuleiro não encontrado"));

        return navioRepo.findByTabuleiro(tabuleiro).stream().map(n -> {
            Map<String, Object> m = new HashMap<>();
            m.put("tamanho", n.getTamanho());
            m.put("linhaInicial", n.getLinhaInicial());
            m.put("colunaInicial", n.getColunaInicial());
            m.put("direcao", n.getDirecao());
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTirosRecebidos(Long jogoId, String username) {
        Usuario jogador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);
        validarJogadorNoJogo(jogo, jogador);

        return tiroRepo.findByJogoAndAtiradorNot(jogo, jogador).stream().map(t -> {
            Map<String, Object> m = new HashMap<>();
            m.put("linha", t.getLinha());
            m.put("coluna", t.getColuna());
            m.put("resultado", t.getResultado());
            return m;
        }).toList();
    }


    @Transactional(readOnly = true)
    public List<Map<String, Object>> getNaviosAfundadosInimigo(Long jogoId, String username) {
        Usuario jogador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);
        validarJogadorNoJogo(jogo, jogador);

        Usuario oponente = jogo.getJogador1().getId().equals(jogador.getId())
                ? jogo.getJogador2() : jogo.getJogador1();

        if (oponente == null) {
            return List.of();
        }

        Tabuleiro tabuleiroOponente = tabuleiroRepo.findByJogoAndDono(jogo, oponente)
                .orElseThrow(() -> new IllegalArgumentException("Tabuleiro do oponente não encontrado"));

        return navioRepo.findByTabuleiro(tabuleiroOponente).stream()
                .filter(Navio::estaAfundado)
                .map(n -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("tamanho", n.getTamanho());
                    m.put("linhaInicial", n.getLinhaInicial());
                    m.put("colunaInicial", n.getColunaInicial());
                    m.put("direcao", n.getDirecao());
                    return m;
                }).toList();
    }

    private void validarJogadorNoJogo(Jogo jogo, Usuario jogador) {
        boolean pertence = jogo.getJogador1().getId().equals(jogador.getId())
                || (jogo.getJogador2() != null && jogo.getJogador2().getId().equals(jogador.getId()));
        if (!pertence) {
            throw new SecurityException("Você não pertence a este jogo");
        }
    }

    public List<Map<String, Object>> getLobby() {
        Instant threshold = Instant.now().minusSeconds(120); // 2 min
        return jogoRepo.findByStatusAndUltimaAtividadeAfter("AGUARDANDO", threshold).stream().map(j -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", j.getId());
            m.put("jogador1", j.getJogador1().getUsername());
            m.put("token", j.getToken());
            return m;
        }).toList();
    }

    @Transactional
    public List<Map<String, Object>> atirarExplosao(Long jogoId, String username, List<Map<String, Object>> tiros) {
        Usuario atirador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);

        if (!jogo.getModo().equals("EXPLOSAO"))
            throw new IllegalStateException("Este jogo não está em modo Explosão");
        if (!jogo.getStatus().equals("JOGANDO"))
            throw new IllegalStateException("Jogo não está em andamento");
        if (!jogo.getTurnoAtual().getId().equals(atirador.getId()))
            throw new IllegalStateException("Não é seu turno");

        // Contar navios vivos do atirador
        Tabuleiro meuTabuleiro = tabuleiroRepo.findByJogoAndDono(jogo, atirador).orElseThrow();
        List<Navio> meusNavios = navioRepo.findByTabuleiro(meuTabuleiro);
        long naviosVivos = meusNavios.stream().filter(n -> !n.estaAfundado()).count();

        if (tiros.size() != naviosVivos)
            throw new IllegalArgumentException("Quantidade de tiros deve ser igual ao número de navios vivos (" + naviosVivos + ")");

        // Validar tiros duplicados entre si
        Set<String> posicoesTiro = new HashSet<>();
        for (Map<String, Object> tiro : tiros) {
            int linha = ((Number) tiro.get("linha")).intValue();
            int coluna = ((Number) tiro.get("coluna")).intValue();
            String chave = linha + "," + coluna;
            if (!posicoesTiro.add(chave))
                throw new IllegalArgumentException("Tiro duplicado na posição " + linha + "," + coluna);
            // Validar tiros anteriores
            if (tiroRepo.existsByJogoAndAtiradorAndLinhaAndColuna(jogo, atirador, linha, coluna))
                throw new IllegalArgumentException("Já atirou na posição " + linha + "," + coluna);
        }

        // Processar todos os tiros
        Usuario oponente = jogo.getJogador1().getId().equals(atirador.getId())
                ? jogo.getJogador2() : jogo.getJogador1();
        Tabuleiro tabuleiroOponente = tabuleiroRepo.findByJogoAndDono(jogo, oponente).orElseThrow();
        List<Navio> naviosOponente = navioRepo.findByTabuleiro(tabuleiroOponente);

        List<Map<String, Object>> resultados = new ArrayList<>();

        for (Map<String, Object> tiro : tiros) {
            int linha = ((Number) tiro.get("linha")).intValue();
            int coluna = ((Number) tiro.get("coluna")).intValue();

            Navio atingido = naviosOponente.stream().filter(n -> n.ocupa(linha, coluna)).findFirst().orElse(null);

            String resultado;
            String tipoAfundado = null;
            Map<String, Object> navioAfundadoInfo = null;

            if (atingido == null) {
                resultado = "AGUA";
            } else {
                atingido.setAcertos(atingido.getAcertos() + 1);
                navioRepo.save(atingido);
                if (atingido.estaAfundado()) {
                    resultado = "AFUNDOU";
                    tipoAfundado = atingido.getTipo();
                    navioAfundadoInfo = new HashMap<>();
                    navioAfundadoInfo.put("tipo", atingido.getTipo());
                    navioAfundadoInfo.put("tamanho", atingido.getTamanho());
                    navioAfundadoInfo.put("linhaInicial", atingido.getLinhaInicial());
                    navioAfundadoInfo.put("colunaInicial", atingido.getColunaInicial());
                    navioAfundadoInfo.put("direcao", atingido.getDirecao());
                } else {
                    resultado = "ACERTO";
                }
            }

            tiroRepo.save(Tiro.builder()
                    .jogo(jogo).atirador(atirador)
                    .linha(linha).coluna(coluna)
                    .resultado(resultado).tipoNavioAfundado(tipoAfundado).build());

            Map<String, Object> r = new HashMap<>();
            r.put("linha", linha);
            r.put("coluna", coluna);
            r.put("resultado", resultado);
            r.put("tipoAfundado", tipoAfundado);
            r.put("navioAfundado", navioAfundadoInfo);
            resultados.add(r);
        }

        // Verificar fim de jogo
        boolean fimDeJogo = naviosOponente.stream().allMatch(Navio::estaAfundado);
        if (fimDeJogo) {
            jogo.setStatus("FINALIZADO");
            jogo.setVencedor(atirador);
        } else {
            // Sempre troca turno no modo explosão
            jogo.setTurnoAtual(oponente);
        }
        jogo.setUltimaAtividade(Instant.now());
        jogoRepo.save(jogo);

        // Enviar evento WebSocket
        Map<String, Object> evento = new HashMap<>();
        evento.put("tipo", "TIROS_EXPLOSAO");
        evento.put("atirador", atirador.getUsername());
        evento.put("tiros", resultados);
        evento.put("fimDeJogo", fimDeJogo);
        evento.put("vencedor", fimDeJogo ? atirador.getUsername() : null);
        evento.put("turnoAtual", fimDeJogo ? null : oponente.getUsername());
        messagingTemplate.convertAndSend("/topic/jogo/" + jogoId, (Object) evento);

        return resultados;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTirosDisponiveis(Long jogoId, String username) {
        Usuario jogador = buscarUsuario(username);
        Jogo jogo = buscarJogo(jogoId);
        validarJogadorNoJogo(jogo, jogador);

        Tabuleiro meuTabuleiro = tabuleiroRepo.findByJogoAndDono(jogo, jogador).orElseThrow();
        List<Navio> meusNavios = navioRepo.findByTabuleiro(meuTabuleiro);
        long naviosVivos = meusNavios.stream().filter(n -> !n.estaAfundado()).count();

        Map<String, Object> r = new HashMap<>();
        r.put("tirosDisponiveis", (int) naviosVivos);
        r.put("modo", jogo.getModo());
        return r;
    }

    private Usuario buscarUsuario(String username) {
        return usuarioRepo.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado"));
    }

    private Jogo buscarJogo(Long id) {
        return jogoRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Jogo não encontrado"));
    }
}
