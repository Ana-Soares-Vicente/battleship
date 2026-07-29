# Battleship - Roteiro de Infraestrutura e Observabilidade

## FASE 0 — Ambiente (WSL + Docker + Kubernetes)

### O que foi instalado:
- WSL com Ubuntu
- Docker Engine (dentro do WSL)
- kubectl (gerenciar Kubernetes)
- kind (cluster Kubernetes local com Docker)

### Comandos úteis:
```bash
# Abrir Ubuntu
wsl

# Verificar cluster
kubectl get nodes

# Verificar pods
kubectl get pods -n battleship

# Parar tudo (no PowerShell do Windows)
wsl --shutdown
```

---

## FASE 1 — Deploy em Kubernetes

### Estrutura criada:
```
battleship/
├── k8s/
│   ├── namespace.yaml
│   ├── postgres-secret.yaml
│   ├── postgres-pvc.yaml
│   ├── postgres-deployment.yaml
│   ├── postgres-service.yaml
│   ├── backend-deployment.yaml    (2 réplicas)
│   ├── backend-service.yaml
│   ├── ingress.yaml               (sticky session + WebSocket)
│   ├── prometheus-config.yaml
│   ├── prometheus.yaml
│   ├── grafana.yaml
│   ├── jaeger.yaml
│   └── deploy.sh
```

### O que está rodando no cluster:
| Pod | Função |
|-----|--------|
| battleship-api (x2) | Backend Java/Spring Boot |
| postgres | Banco de dados PostgreSQL |
| prometheus | Coleta métricas |
| grafana | Dashboards |
| jaeger | Traces distribuídos |

### Requisitos atendidos:
- ✅ 2 réplicas do backend
- ✅ Ingress com NGINX
- ✅ Sticky Session (cookie BATTLESHIP_STICKY)
- ✅ WebSocket com timeout estendido

---

## FASE 2 — Observabilidade

### URLs de acesso (navegador):
| Serviço | URL | Login |
|---------|-----|-------|
| Backend API | http://battleship.local | - |
| Grafana | http://grafana.local | admin / admin |
| Prometheus | http://prometheus.local | - |
| Jaeger | http://jaeger.local | - |

### Arquivo hosts (obrigatório):
Abrir como Administrador: `C:\Windows\System32\drivers\etc\hosts`

Adicionar:
```
127.0.0.1 battleship.local
127.0.0.1 grafana.local
127.0.0.1 prometheus.local
127.0.0.1 jaeger.local
```

### O que foi instrumentado:
- **Métricas (Prometheus + Grafana)**:
  - Request rate (req/s)
  - Response time p95 (ms)
  - JVM Memory
  - HikariCP connection pool (queries ao banco)
  - Slow requests (>1s)
  
- **Traces (OpenTelemetry + Jaeger)**:
  - Traces distribuídos de cada requisição
  - Identificação de requisições lentas
  - Correlação de logs com traceId/spanId

### Endpoint de métricas raw:
```
http://battleship.local/actuator/prometheus
```

---

## COMO SUBIR TUDO DO ZERO

Se precisar recriar o ambiente:

### 1. Abrir Ubuntu (WSL):
```bash
wsl
```

### 2. Rodar o script de deploy:
```bash
chmod +x /mnt/c/Users/avicente/Documents/battleship/k8s/deploy.sh
/mnt/c/Users/avicente/Documents/battleship/k8s/deploy.sh
```

### 3. Depois aplicar observabilidade:
```bash
cd /mnt/c/Users/avicente/Documents/battleship/k8s
kubectl apply -f prometheus-config.yaml
kubectl apply -f prometheus.yaml
kubectl apply -f grafana.yaml
kubectl apply -f jaeger.yaml
kubectl apply -f ingress.yaml
```

### 4. Verificar tudo rodando:
```bash
kubectl get pods -n battleship
```
Todos devem estar `1/1 Running`.

---

## COMO REBUILDAR O BACKEND

Se alterar código Java:
```bash
cd /mnt/c/Users/avicente/Documents/battleship/battleship-api
docker build -t battleship-api:latest .
kind load docker-image battleship-api:latest
kubectl rollout restart deployment/battleship-api -n battleship
```

---

## FASE 3 — Resiliência e Qualidade

### 3.1 — Cache com Redis

**Objetivo**: Reduzir carga no banco de dados para consultas frequentes (polling do lobby).

#### O que foi implementado:
- Redis 7 Alpine rodando no cluster K8s (128MB, política LRU)
- Spring Cache com `@Cacheable("lobby")` no endpoint GET `/api/jogos/lobby`
- TTL de 10 segundos — dados do lobby ficam em cache por 10s
- Cache invalidado automaticamente com `@CacheEvict` quando:
  - Novo jogo é criado (`criarJogo`)
  - Jogador entra em um jogo (`entrarNoJogo`)
  - Jogador entra por token (`entrarPorToken`)
- Serialização JSON para valores e String para chaves

#### Arquivos criados/modificados:
| Arquivo | Mudança |
|---------|---------|
| `pom.xml` | Adicionou spring-boot-starter-data-redis e spring-boot-starter-cache |
| `CacheConfig.java` | Configuração do RedisCacheManager com TTL |
| `JogoService.java` | Anotações @Cacheable e @CacheEvict |
| `application.yml` | Configuração spring.data.redis |
| `k8s/redis-deployment.yaml` | Deploy do Redis no K8s |
| `k8s/redis-service.yaml` | Service ClusterIP para Redis |
| `k8s/backend-deployment.yaml` | Env var REDIS_HOST |

#### Benefício esperado:
- Lobby é chamado por polling (a cada 2-5s por cada cliente)
- Com cache de 10s: redução de ~80-90% das queries ao PostgreSQL para esse endpoint
- Latência do lobby: de ~50-100ms (DB) para ~1-5ms (Redis)

---

### 3.2 — Rate Limiting (dois níveis)

**Objetivo**: Proteger a aplicação contra abuso e ataques de força bruta.

#### Nível 1 — NGINX Ingress (infraestrutura):
- 50 requisições/segundo por IP (global)
- Burst multiplier de 5 (permite picos de até 250 req/s momentaneamente)
- Configurado via annotations no Ingress

#### Nível 2 — Aplicação (Spring Boot Filter):
- Endpoints de autenticação (`/api/auth/login`, `/api/auth/register`): **5 requisições por minuto** por IP
- Endpoints gerais: **100 requisições por minuto** por IP
- Algoritmo: Token Bucket com refill automático
- Resposta quando excedido: HTTP 429 com JSON detalhado
- Limpeza automática de buckets inativos a cada 5 minutos
- Detecta IP real via headers X-Forwarded-For / X-Real-IP (funciona atrás do NGINX)

#### Arquivos criados/modificados:
| Arquivo | Mudança |
|---------|---------|
| `RateLimitFilter.java` | Novo filtro com Token Bucket por IP |
| `SecurityConfig.java` | Registra RateLimitFilter antes do JWT |
| `BattleshipApplication.java` | @EnableScheduling para cleanup |
| `k8s/ingress.yaml` | Annotations limit-rps e limit-burst-multiplier |

#### Benefício esperado:
- Proteção contra brute force em login/registro
- Proteção contra DDoS a nível de infraestrutura (NGINX)
- App permanece responsiva mesmo sob ataque

---

### 3.3 — Testes de Carga (k6)

**Objetivo**: Validar performance e identificar limites da aplicação sob carga.

#### Scripts criados:

| Script | Cenário | VUs | Duração |
|--------|---------|-----|---------|
| `load-test.js` | Carga normal + spike | 0→20→50→0 | 2m30s |
| `stress-test.js` | Estresse com mix de endpoints | 0→100→0 | 3m30s |
| `auth-rate-limit-test.js` | Validação do rate limiting | 10+1 | 30s |

#### Thresholds definidos:
- **Load Test**: p(95) < 500ms, erro < 5%
- **Stress Test**: p(95) < 1000ms, p(99) < 2000ms, erro < 10%
- **Rate Limit Test**: pelo menos 1 resposta 429 (validação ativa)

#### Como executar:
```bash
# Instalar k6 (WSL)
sudo apt-get install k6

# Ou Windows (chocolatey)
choco install k6

# Rodar testes
cd /mnt/c/Users/avicente/Documents/battleship/k6
k6 run load-test.js
k6 run stress-test.js
k6 run auth-rate-limit-test.js

# Com output JSON para análise
k6 run --out json=results.json load-test.js
```

---

## COMO SUBIR TUDO (incluindo resiliência)

### 1. Abrir Ubuntu (WSL):
```bash
wsl
```

### 2. Rodar o script de deploy base:
```bash
chmod +x /mnt/c/Users/avicente/Documents/battleship/k8s/deploy.sh
/mnt/c/Users/avicente/Documents/battleship/k8s/deploy.sh
```

### 3. Aplicar Redis:
```bash
cd /mnt/c/Users/avicente/Documents/battleship/k8s
kubectl apply -f redis-deployment.yaml
kubectl apply -f redis-service.yaml
```

### 4. Aplicar observabilidade + ingress atualizado:
```bash
kubectl apply -f prometheus-config.yaml
kubectl apply -f prometheus.yaml
kubectl apply -f grafana.yaml
kubectl apply -f jaeger.yaml
kubectl apply -f ingress.yaml
```

### 5. Rebuildar backend (com cache + rate limiting):
```bash
cd /mnt/c/Users/avicente/Documents/battleship/battleship-api
docker build -t battleship-api:latest .
kind load docker-image battleship-api:latest
kubectl rollout restart deployment/battleship-api -n battleship
```

### 6. Verificar tudo rodando:
```bash
kubectl get pods -n battleship
```
Devem aparecer: battleship-api (x2), postgres, redis, prometheus, grafana, jaeger — todos `Running`.

### 7. Testar cache funcionando:
```bash
# Acessar Redis no cluster
kubectl exec -it deploy/redis -n battleship -- redis-cli
> KEYS *
# Após acessar o lobby, deve aparecer a key "lobby::*"
> TTL lobby::*
# Deve retornar ~10 ou menos
```

### 8. Testar rate limiting:
```bash
# Bombardear login (deve retornar 429 após 5 tentativas)
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://battleship.local/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done
```

---

## RESUMO — Requisitos Atendidos

### Deploy em Kubernetes:
- ✅ 2 réplicas do backend
- ✅ Ingress com NGINX
- ✅ Sticky Session (cookie BATTLESHIP_STICKY)
- ✅ WebSocket com timeout estendido

### Observabilidade:
- ✅ Métricas coletadas (Prometheus + Grafana)
- ✅ Traces distribuídos (OpenTelemetry + Jaeger)
- ✅ Identificação de requisições lentas (p95, p99)
- ✅ Identificação de queries lentas (HikariCP metrics)
- ✅ Dashboards disponíveis (Grafana, Prometheus UI, Jaeger UI)

### Resiliência e Qualidade:
- ✅ Cache com Redis (lobby, TTL 10s)
- ✅ Rate limiting (NGINX + aplicação)
- ✅ Testes de carga com k6 (3 cenários)

### Estrutura final de arquivos:
```
battleship/
├── k8s/
│   ├── namespace.yaml
│   ├── postgres-secret.yaml
│   ├── postgres-pvc.yaml
│   ├── postgres-deployment.yaml
│   ├── postgres-service.yaml
│   ├── backend-deployment.yaml    (2 réplicas + REDIS_HOST)
│   ├── backend-service.yaml
│   ├── ingress.yaml               (sticky session + rate limiting)
│   ├── redis-deployment.yaml      (cache)
│   ├── redis-service.yaml
│   ├── prometheus-config.yaml
│   ├── prometheus.yaml
│   ├── grafana.yaml
│   ├── jaeger.yaml
│   └── deploy.sh
├── k6/
│   ├── load-test.js               (teste de carga normal)
│   ├── stress-test.js             (teste de estresse)
│   ├── auth-rate-limit-test.js    (validação rate limiting)
│   └── README.md
└── battleship-api/
    └── src/main/java/com/ana/battleship/
        ├── config/
        │   ├── CacheConfig.java       (Redis cache manager)
        │   ├── RateLimitFilter.java   (token bucket per IP)
        │   └── SecurityConfig.java    (filtro registrado)
        └── service/
            └── JogoService.java       (@Cacheable + @CacheEvict)
```
