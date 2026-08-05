# Análise de Performance — Battleship API

**Data:** 30/07/2026  
**Ambiente:** Desenvolvimento local (Windows + WSL2 + Docker Compose)  
**Stack:** Spring Boot 4.1 + H2 + Redis 7.4 + Micrometer + Prometheus + Grafana + Jaeger

---

## Infraestrutura de Observabilidade

### Arquitetura

```
┌─────────────────┐     ┌────────────────┐     ┌──────────────┐
│  Battleship API │────►│  Prometheus    │────►│   Grafana    │
│  (Spring Boot)  │     │  scrape /15s   │     │  Dashboard   │
│  :8080          │     │  :9090         │     │  :3000       │
└────────┬────────┘     └────────────────┘     └──────────────┘
         │
         │ OTLP traces
         ▼
┌─────────────────┐
│     Jaeger      │
│   (all-in-one)  │
│   :16686        │
└─────────────────┘
         
┌─────────────────┐
│     Redis       │
│  (cache + rate  │
│   limiting)     │
│   :6379         │
└─────────────────┘
```

### Configuração

| Componente | Imagem | Configuração |
|------------|--------|--------------|
| Prometheus | `prom/prometheus:v2.53.0` | scrape_interval: 15s, target: API :8080 |
| Grafana | `grafana/grafana:11.1.0` | Dashboard "Battleship Completo" provisionado |
| Jaeger | `jaegertracing/all-in-one:1.58` | OTLP collector habilitado |
| Redis | `redis:7-alpine` | Cache lobby TTL 10s, rate limiting |

### Métricas Exportadas

A API expõe via `/actuator/prometheus`:
- `http_server_requests_seconds` — latência HTTP por endpoint, método e status
- `spring_data_repository_invocations` — duração de queries por repositório e método
- `cache_gets_total{result=hit|miss}` — hits e misses do cache Redis
- `cache_puts_total` — escritas no cache
- `spring_websocket_sessions` — sessões WebSocket ativas
- `spring_websocket_messages_sent_total` / `received_total` — throughput STOMP
- `hikaricp_connections_*` — pool de conexões ao banco
- `jvm_memory_used_bytes`, `jvm_threads_live` — saúde da JVM

### Tracing Distribuído

- **Protocolo:** OpenTelemetry (OTLP HTTP)
- **Endpoint:** `http://localhost:4318/v1/traces`
- **Sampling:** 100% (probability: 1.0)
- **Correlation:** Log pattern inclui `traceId` e `spanId` para correlação log↔trace

---

## Performance dos Endpoints

### Teste de Carga — k6 (28/07/2026)

**Cenário:** Rampa progressiva 0→20→50→0 VUs durante 2min30s, simulando fluxo de lobby (health + jogos/lobby autenticado).

| Métrica | Valor |
|---------|-------|
| Total de requests | 7.721 |
| Throughput | **51.2 req/s** |
| Latência média | **1.83ms** |
| Latência p50 | 1.70ms |
| Latência p90 | 2.42ms |
| Latência p95 | **2.75ms** |
| Latência máxima | 80.31ms |
| VUs máximo | 50 |

**Resultado:** Threshold de p95 < 500ms atingido com folga (2.75ms real). A API opera com latência sub-5ms mesmo sob carga de 50 usuários simultâneos.

### Latência por Endpoint (ambiente local quente)

| Endpoint | Avg | Observação |
|----------|-----|------------|
| `POST /api/auth/register` | ~200ms | Inclui hash bcrypt + save |
| `POST /api/auth/login` | ~20ms | Validação JWT |
| `GET /api/jogos/lobby` | ~60ms | Com cache Redis (hit) |
| `POST /api/jogos` | ~130ms | Criação de jogo + evict cache |
| `GET /actuator/health` | <1ms | Health check simples |

### Latência dos Repositórios (Spring Data)

| Repositório | Invocações | Tempo Total | Avg/query |
|-------------|-----------|-------------|-----------|
| JogoRepository | 1.341 | 966ms | **0.72ms** |
| UsuarioRepository | 213 | 372ms | **1.75ms** |
| TiroRepository | 123 | 158ms | **1.29ms** |
| NavioRepository | 145 | 85ms | **0.59ms** |
| TabuleiroRepository | 75 | 59ms | **0.79ms** |

**Análise:** Todas as queries executam em menos de 2ms na média. Com banco H2 in-process, não há latência de rede. Em produção com PostgreSQL remoto, esses valores subiriam proporcionalmente à latência de rede (~50-200ms por roundtrip).

---

## Cache — Redis

### Configuração

- **CacheManager:** `RedisCacheManager` com `enableStatistics()`
- **Cache "lobby":** TTL de 10 segundos, invalidação via `@CacheEvict` em operações de escrita (criar jogo, entrar em jogo, posicionar navios)
- **Serialização:** JSON (GenericJackson2JsonRedisSerializer)

### Resultados Observados

| Métrica | Valor |
|---------|-------|
| Cache Hits | **14** |
| Cache Misses | **1** |
| Cache Puts | **1** |
| Hit Rate | **93.3%** |

**Análise:** O primeiro acesso ao lobby causa 1 miss + 1 put. Os acessos subsequentes (dentro da janela de 10s TTL) são servidos diretamente do Redis sem tocar no banco. Em uso real com múltiplos jogadores acessando o lobby repetidamente, a hit rate tende a 95%+.

**Por que cache apenas no lobby:**
- O estado do jogo muda a cada turno — cache invalidaria imediatamente
- O lobby é leitura frequente com escrita rara (só muda quando alguém cria/entra em jogo)
- TTL de 10s garante consistência aceitável para lista de salas

---

## Rate Limiting

### Configuração

O `RateLimitFilter` usa Redis como backend para controle de taxa por IP, protegendo contra abuso e ataques de força bruta.

### Teste de Rate Limiting — k6 (30/07/2026)

**Cenário:** 20 VUs martelando `POST /api/auth/login` com credenciais inválidas durante 30 segundos, sem sleep entre requests.

| Métrica | Valor |
|---------|-------|
| Total de requests | **175.650** |
| Throughput | **5.279 req/s** |
| Requests bloqueados (429) | **175.630** |
| Requests que passaram | **5** |
| Taxa de bloqueio | **99.997%** |
| Latência p95 | 7.91ms |
| App responsiva durante teste | ✅ 100% (health check OK) |

**Análise:** O rate limiter bloqueou efetivamente 99.997% das requisições abusivas. Apenas ~5 requests passaram (os primeiros antes de atingir o limite). A aplicação permaneceu 100% responsiva para outros endpoints durante o ataque, demonstrando que o rate limiting protege sem degradar o serviço para usuários legítimos.

**Características do Rate Limiting:**
- Baseado em IP via Redis (compartilhado entre instâncias se escalar)
- Resposta rápida (p95 < 8ms mesmo rejeitando 5.279 req/s)
- Não bloqueia endpoints de health/actuator

---

## WebSocket — Sessões e Mensagens

### Configuração

- **Endpoint:** `/ws` (STOMP nativo) e `/ws-sockjs` (fallback SockJS)
- **Broker:** SimpleBroker com prefixo `/topic`
- **Autenticação:** Token JWT no header STOMP `Authorization`
- **Grace period:** 30s antes de declarar abandono após desconexão

### Métricas Exportadas

| Métrica | Descrição |
|---------|-----------|
| `spring_websocket_sessions` | Gauge — conexões ativas no momento |
| `spring_websocket_messages_sent_total` | Counter — mensagens enviadas aos clientes |
| `spring_websocket_messages_received_total` | Counter — mensagens recebidas dos clientes |

**Instrumentação:** Interceptor no canal outbound conta automaticamente todas as mensagens enviadas via `SimpMessagingTemplate`. EventListeners em `SessionConnectEvent` / `SessionDisconnectEvent` mantêm o gauge de sessões ativas.

---

## JVM e Infraestrutura

### Recursos

| Métrica | Valor |
|---------|-------|
| JVM Heap usado | **121 MB** |
| JVM Non-Heap | **156 MB** |
| Threads vivas | **55** |
| Startup time | **13.8s** |
| HikariCP pool size | 10 (min=10, max=10) |
| HikariCP timeouts | 0 |
| HikariCP avg usage | **1.14ms/connection** |

### Saúde do Pool de Conexões

| Métrica | Valor |
|---------|-------|
| Conexões totais | 10 |
| Conexões ativas | 0 (idle) |
| Conexões idle | 10 |
| Pending threads | 0 |
| Connection acquire time (avg) | **0.027ms** |
| Connection creation time (avg) | **1.04ms** |

**Análise:** O pool de conexões está saudável — zero timeouts, zero pending threads, acquire time negligível. O pool de 10 conexões é mais que suficiente para a carga atual. Não há contenção.

---

## Traces — Jaeger

### O que é rastreado

Cada request HTTP gera um trace completo com spans para:
1. **Filtro de segurança** — validação JWT
2. **Controller** — recebimento e dispatch
3. **Service** — lógica de negócio (`@Observed`)
4. **Repository** — queries ao banco (Spring Data instrumentation)
5. **Redis** — operações de cache

### Correlação Log ↔ Trace

Pattern de log configurado: `[battleship-api,{traceId},{spanId}]`

Permite buscar no Jaeger pelo traceId presente em qualquer log de erro, criando uma ponte direta entre observação de logs e análise de traces.

### Acesso

- **Jaeger UI:** http://localhost:16686
- **Service:** `battleship-api`
- Filtrar por operação (ex: `GET /api/jogos/lobby`) para ver breakdown de latência

---

## Conclusões

### Pontos Fortes

1. **Latência excelente** — p95 de 2.75ms sob carga de 50 VUs demonstra que a aplicação é extremamente responsiva em ambiente local
2. **Rate limiting eficaz** — 99.997% de bloqueio com resposta em <8ms protege sem degradar performance
3. **Cache funcional** — 93%+ hit rate no lobby reduz carga no banco significativamente
4. **Pool de conexões saudável** — zero contenção, zero timeouts
5. **Observabilidade completa** — métricas (Prometheus), traces (Jaeger), dashboards (Grafana) cobrindo todos os aspectos da aplicação

### Pontos de Atenção

1. **Startup de 13.8s** — aceitável para desenvolvimento, mas em produção com Free Tier (Render) causa cold start perceptível
2. **Banco H2 local** — latências de repositório sub-ms não refletem produção com PostgreSQL remoto (adicionaria ~50-200ms/query de rede)
3. **WebSocket sem carga real** — métricas implementadas mas sem dados significativos até ter partidas ativas simultâneas

### Recomendações Futuras

- Monitorar latência do Redis separadamente quando em produção (atualmente localhost = ~0ms)
- Adicionar alerta no Grafana para `hikaricp_connections_pending > 0` (indicaria saturação do pool)
- Considerar cache no perfil/ranking se implementado (alta leitura, baixa escrita)
- Load test com WebSocket ativo (simular partida completa com 2 jogadores trocando tiros)
