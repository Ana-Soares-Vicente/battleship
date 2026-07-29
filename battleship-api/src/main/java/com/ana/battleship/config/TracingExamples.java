package com.ana.battleship.config;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.stereotype.Component;

/**
 * Exemplos de instrumentação manual com OpenTelemetry.
 * 
 * Demonstra 3 formas de criar spans manuais:
 * 1. @WithSpan - para métodos inteiros
 * 2. Tracer - para blocos de código específicos
 * 3. Span.current() - para adicionar atributos ao span ativo
 * 
 * Use estes padrões em operações que precisam de visibilidade
 * detalhada no Jaeger (lógica de negócio complexa, chamadas externas, etc).
 */
@Component
public class TracingExamples {

    private final Tracer tracer;

    public TracingExamples(Tracer tracer) {
        this.tracer = tracer;
    }

    // ========================================================================
    // EXEMPLO 1: @WithSpan — cria um span automaticamente para o método inteiro
    // ========================================================================
    @WithSpan("validar-jogada")
    public boolean validarJogada(
            @SpanAttribute("jogo.id") Long jogoId,
            @SpanAttribute("jogador") String jogador,
            @SpanAttribute("posicao.linha") int linha,
            @SpanAttribute("posicao.coluna") int coluna) {

        // O span é criado automaticamente ao entrar no método
        // @SpanAttribute adiciona os parâmetros como atributos do span
        
        // Adicionar informação extra ao span corrente
        Span.current().setAttribute("jogo.tipo", "PADRAO");
        
        return linha >= 0 && linha < 10 && coluna >= 0 && coluna < 10;
    }

    // ========================================================================
    // EXEMPLO 2: Tracer — controle total sobre início/fim do span
    // ========================================================================
    public void processarOperacaoComplexa(Long jogoId, String operacao) {
        // Criar span manualmente para um bloco específico
        Span span = tracer.spanBuilder("processar-operacao-complexa")
                .setAttribute("jogo.id", jogoId)
                .setAttribute("operacao", operacao)
                .startSpan();

        try {
            // Simula processamento
            Thread.sleep(10);
            
            span.setAttribute("resultado", "sucesso");
            span.setStatus(StatusCode.OK);
        } catch (Exception e) {
            span.setStatus(StatusCode.ERROR, e.getMessage());
            span.recordException(e);
        } finally {
            span.end(); // IMPORTANTE: sempre finalizar o span
        }
    }

    // ========================================================================
    // EXEMPLO 3: Span.current() — enriquecer o span ativo (do controller/service)
    // ========================================================================
    public void enriquecerSpanAtual(Long jogoId, String username) {
        // Pegar o span que já está ativo (criado pelo controller ou @Observed)
        Span currentSpan = Span.current();
        
        // Adicionar atributos de negócio ao span ativo
        currentSpan.setAttribute("app.jogo.id", jogoId);
        currentSpan.setAttribute("app.usuario", username);
        currentSpan.setAttribute("app.operacao.timestamp", System.currentTimeMillis());
        
        // Adicionar evento (aparece no timeline do span no Jaeger)
        currentSpan.addEvent("operacao-iniciada");
        
        // Mais processamento...
        
        currentSpan.addEvent("operacao-concluida");
    }
}
