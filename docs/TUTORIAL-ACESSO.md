# Tutorial — Como Acessar Cada Parte do Desafio

## Pré-requisitos

- Docker Desktop (com WSL2 integration)
- Kind (`kind` CLI)
- kubectl
- k6 (para testes de carga)
- Acesso ao terminal WSL

---

## 1. Subir o Ambiente Local (Docker Compose)

Para desenvolvimento local, suba a stack de observabilidade:

```bash
cd /mnt/c/Users/avicente/Documents/battleship
docker compose up -d
```

Isso inicia:
- **Jaeger** → http://localhost:16686
- **Prometheus** → http://localhost:9090
- **Grafana** → http://localhost:3000 (login: admin / admin)

Depois inicie a API:

```bash
cd battleship-api
./mvnw spring-boot:run
```

A API fica em http://localhost:8080.

---

## 2. Deploy em Kubernetes (Kind)

Para o ambiente completo em K8s com 2 réplicas:

```bash
cd /mnt/c/Users/avicente/Documents/battleship/k8s
bash deploy.sh
```

O script faz tudo automaticamente:
1. Cria cluster Kind com port mappings (80/443)
2. Instala NGINX Ingress Controller
3. Builda a imagem Docker da API
4. Carrega a imagem no cluster
5. Aplica todos os manifests (Postgres, Redis, Backend, Ingress)

### Configurar o /etc/hosts

Adicione ao arquivo `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 battleship.local
127.0.0.1 grafana.local
127.0.0.1 prometheus.local
127.0.0.1 jaeger.local
```

### Verificar o deploy

```bash
kubectl get pods -n battleship
kubectl get ingress -n battleship
```

Deve mostrar **2 pods** do `battleship-api` em Running.

---

## 3. Acessando Cada Ferramenta

### 3.1 API (Battleship)

| Ambiente | URL |
|----------|-----|
| Local | http://localhost:8080 |
| Kubernetes | http://battleship.local |

Endpoints principais:
- `POST /api/auth/register` — cadastro
- `POST /api/auth/login` — login (retorna JWT)
- `GET /api/jogos/lobby` — partidas disponíveis
- `POST /api/jogos` — criar partida
- `GET /api/health` — health check

Exemplo de teste rápido:

```bash
# Registrar
curl -X POST http://battleship.local/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"teste","password":"123456"}'

# Login
curl -X POST http://battleship.local/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teste","password":"123456"}'
```

---

### 3.2 Grafana (Dashboards)

| Ambiente | URL |
|----------|-----|
| Local | http://localhost:3000 |
| Kubernetes | http://grafana.local |

**Login:** admin / admin

**Acessar o dashboard completo:**
- URL direta: http://localhost:3000/d/battleship-completo (local) ou http://grafana.local/d/battleship-completo (K8s)
- Ou: menu lateral → Dashboards → pasta **Battleship**

**O que o dashboard mostra:**

| Seção | Painéis |
|-------|---------|
| KPIs | Partidas criadas, finalizadas, jogos em andamento, jogadores online, tiros, navios afundados |
| Gameplay | Partidas/s, tiros/s, navios/s, entradas/s, lobby/s, revanches/abandonos, duração das partidas |
| Performance | Top 5 endpoints mais lentos, latência p95, taxa de erros HTTP, rate limiting (429) |
| Banco de Dados | Tempo de query por repositório (MAX/AVG), queries/s, HikariCP pool de conexões |
| Cache | Cache hit vs miss (Redis) |
| Infraestrutura | JVM heap memory, CPU, threads, GC pauses, HikariCP tempo de aquisição |
| WebSocket | Sessões ativas, jogadores online, mensagens STOMP/s |

---

### 3.3 Prometheus (Métricas Raw)

| Ambiente | URL |
|----------|-----|
| Local | http://localhost:9090 |
| Kubernetes | http://prometheus.local |

**Queries úteis:**

```promql
# Requisições por segundo
rate(http_server_requests_seconds_count{application="battleship-api"}[1m])

# Latência P95
histogram_quantile(0.95, rate(http_server_requests_seconds_bucket{application="battleship-api"}[5m]))

# Cache hit ratio
cache_gets_total{result="hit"} / (cache_gets_total{result="hit"} + cache_gets_total{result="miss"})

# Partidas ativas
battleship_matches_active

# Tempo de query nos repositórios
spring_data_repository_invocations_seconds_max{application="battleship-api"}
```

---

### 3.4 Jaeger (Traces Distribuídos)

| Ambiente | URL |
|----------|-----|
| Local | http://localhost:16686 |
| Kubernetes | http://jaeger.local |

**Como usar:**
1. Abra o Jaeger
2. Em **Service**, selecione `battleship-api`
3. Clique em **Find Traces**
4. Cada trace mostra a cadeia completa: Controller → Service → Repository → DB

**Identificar requisições lentas:**
- Ordene por duração (Longest First)
- Clique em um trace para ver os spans individuais
- Os spans mostram tempo em cada camada (service, query, etc.)

**O que observar:**
- Spans `jogo-service` e `auth-service` (criados por `@Observed`)
- Spans de queries JPA (instrumentação automática do Spring Data)
- Correlação com logs via `traceId` e `spanId`

---

### 3.5 Rate Limiting

**Testar localmente:**

```bash
# Disparar 10 requests rápidas no endpoint de login (limite: 5/min)
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://battleship.local/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"x","password":"x"}'
done
```

As primeiras 5 retornam 401 (credenciais erradas) e as seguintes retornam **429 Too Many Requests**.

**No Kubernetes:** o Ingress NGINX também aplica rate limiting de 50 rps por IP.

---

### 3.6 Cache (Redis)

O cache está ativo no endpoint do lobby. Para observar:

1. Faça login e acesse o lobby várias vezes:
   ```bash
   curl -H "Authorization: Bearer <token>" http://battleship.local/api/jogos/lobby
   ```
2. No Grafana, veja o painel **"Cache - Hit vs Miss (Redis)"**
3. No Prometheus: `cache_gets_total{cache="lobby"}`

**TTLs configurados:**
- `lobby`: 10 segundos
- Default: 5 minutos

---

### 3.7 Testes de Carga (k6)

```bash
cd /mnt/c/Users/avicente/Documents/battleship/k6

# Load test (rampa 0→20→50 VUs, 2min30s)
k6 run load-test-local.js

# Stress test (até 100 VUs)
k6 run stress-test.js

# Teste de rate limiting
k6 run auth-rate-limit-test.js

# Com output JSON para análise
k6 run --out json=results.json load-test-local.js
```

**Resultados esperados (já documentados):**
- Throughput: ~51 req/s
- Latência P95: ~2.75ms
- Rate limiter bloqueando corretamente requests excessivas

Os resultados completos estão em `k6/RESULTADOS-LOAD-TEST.md`.

---

### 3.8 Sticky Session (K8s)

Para verificar que a sticky session está funcionando:

```bash
# Fazer duas requests e verificar o cookie
curl -v http://battleship.local/api/health 2>&1 | grep -i "set-cookie"
```

Deve retornar o cookie `BATTLESHIP_STICKY`. Requests subsequentes com esse cookie vão para o mesmo pod.

**Verificar em qual pod está caindo:**

```bash
# Ver logs de cada pod
kubectl logs -n battleship -l app=battleship-api --prefix | grep "health"
```

---

### 3.9 Verificar 2 Réplicas

```bash
kubectl get pods -n battleship -l app=battleship-api
```

Saída esperada:

```
NAME                              READY   STATUS    RESTARTS   AGE
battleship-api-xxxxxxxx-xxxxx     1/1     Running   0          5m
battleship-api-xxxxxxxx-yyyyy     1/1     Running   0          5m
```

---

## Resumo de URLs

| Ferramenta | Local (Docker Compose) | Kubernetes (Kind) |
|------------|----------------------|-------------------|
| API | http://localhost:8080 | http://battleship.local |
| Grafana | http://localhost:3000 | http://grafana.local |
| Prometheus | http://localhost:9090 | http://prometheus.local |
| Jaeger | http://localhost:16686 | http://jaeger.local |
| Frontend | http://localhost:5173 | Vercel (produção) |

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Dashboard não aparece no Grafana | Acesse direto: `/d/battleship-completo` |
| Pods em CrashLoopBackOff | `kubectl logs -n battleship <pod-name>` |
| Ingress não responde | Verificar se NGINX controller está rodando: `kubectl get pods -n ingress-nginx` |
| Prometheus sem dados | Verificar target: Prometheus UI → Status → Targets |
| Jaeger sem traces | Verificar env `OTEL_EXPORTER_OTLP_ENDPOINT` no pod |
| Rate limit não funciona | Testar sem token Bearer (requests autenticadas não são limitadas no app) |
