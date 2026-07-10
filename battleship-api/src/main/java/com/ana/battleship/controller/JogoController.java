package com.ana.battleship.controller;

import com.ana.battleship.service.JogoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.*;

@RestController
@RequestMapping("/api/jogos")
@RequiredArgsConstructor
public class JogoController {

    private final JogoService jogoService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> criar(@RequestBody(required = false) Map<String, Object> body, Principal principal) {
        String skin = (body != null && body.containsKey("skin")) ? (String) body.get("skin") : null;
        String modo = (body != null && body.containsKey("modo")) ? (String) body.get("modo") : "PADRAO";
        var jogo = jogoService.criarJogo(principal.getName(), skin, modo);
        return jogoService.getEstadoJogoInterno(jogo.getId());
    }

    @PostMapping("/{id}/entrar")
    public Map<String, Object> entrar(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body, Principal principal) {
        String skin = (body != null && body.containsKey("skin")) ? (String) body.get("skin") : null;
        jogoService.entrarNoJogo(id, principal.getName(), skin);
        return jogoService.getEstadoJogo(id, principal.getName());
    }

    @PostMapping("/entrar-por-token/{token}")
    public Map<String, Object> entrarPorToken(@PathVariable String token, @RequestBody(required = false) Map<String, Object> body, Principal principal) {
        String skin = (body != null && body.containsKey("skin")) ? (String) body.get("skin") : null;
        var jogo = jogoService.entrarPorToken(token, principal.getName(), skin);
        return jogoService.getEstadoJogo(jogo.getId(), principal.getName());
    }

    @PostMapping("/{id}/posicionar-navios")
    @SuppressWarnings("unchecked")
    public void posicionarNavios(@PathVariable Long id, @RequestBody Map<String, Object> body, Principal principal) {
        List<Map<String, Object>> navios = (List<Map<String, Object>>) body.get("navios");
        jogoService.posicionarNavios(id, principal.getName(), navios);
    }

    @PostMapping("/{id}/atirar")
    public Map<String, Object> atirar(@PathVariable Long id, @RequestBody Map<String, Object> body, Principal principal) {
        int linha = (int) body.get("linha");
        int coluna = (int) body.get("coluna");
        return jogoService.atirar(id, principal.getName(), linha, coluna);
    }

    @PostMapping("/{id}/atirar-explosao")
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> atirarExplosao(@PathVariable Long id, @RequestBody Map<String, Object> body, Principal principal) {
        List<Map<String, Object>> tiros = (List<Map<String, Object>>) body.get("tiros");
        return jogoService.atirarExplosao(id, principal.getName(), tiros);
    }

    @GetMapping("/{id}/tiros-disponiveis")
    public Map<String, Object> tirosDisponiveis(@PathVariable Long id, Principal principal) {
        return jogoService.getTirosDisponiveis(id, principal.getName());
    }

    @GetMapping("/{id}")
    public Map<String, Object> verJogo(@PathVariable Long id, Principal principal) {
        return jogoService.getEstadoJogo(id, principal.getName());
    }

    @GetMapping("/{id}/meus-tiros")
    public List<Map<String, Object>> meusTiros(@PathVariable Long id, Principal principal) {
        return jogoService.getMeusTiros(id, principal.getName());
    }

    @GetMapping("/{id}/minha-frota")
    public List<Map<String, Object>> minhaFrota(@PathVariable Long id, Principal principal) {
        return jogoService.getMinhaFrota(id, principal.getName());
    }

    @GetMapping("/{id}/tiros-recebidos")
    public List<Map<String, Object>> tirosRecebidos(@PathVariable Long id, Principal principal) {
        return jogoService.getTirosRecebidos(id, principal.getName());
    }

    @GetMapping("/{id}/navios-afundados-inimigo")
    public List<Map<String, Object>> naviosAfundadosInimigo(@PathVariable Long id, Principal principal) {
        return jogoService.getNaviosAfundadosInimigo(id, principal.getName());
    }

    @GetMapping("/lobby")
    public List<Map<String, Object>> lobby() {
        return jogoService.getLobby();
    }
}
