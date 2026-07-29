#!/bin/bash
# ==============================================================================
#  BATTLESHIP - Script de Observabilidade
#  Ativa e mostra como acessar: Jaeger, Prometheus, Grafana, API
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=====================================================${NC}"
echo -e "${CYAN}  BATTLESHIP - Observabilidade (Dev Local)${NC}"
echo -e "${CYAN}=====================================================${NC}"
echo ""

# ==============================================================================
# OPÇÃO 1: DESENVOLVIMENTO LOCAL (Docker Compose + App via Maven)
# ==============================================================================

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  OPÇÃO 1: DEV LOCAL (Docker + Maven)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Passo 1 - Subir Jaeger (OTLP collector + UI):"
echo ""
echo "  cd /mnt/c/Users/avicente/Documents/battleship"
echo "  docker compose up -d"
echo ""
echo "Passo 2 - Subir a API Spring Boot:"
echo ""
echo "  cd /mnt/c/Users/avicente/Documents/battleship/battleship-api"
echo "  ./mvnw spring-boot:run"
echo ""
echo "Passo 3 - Testar um endpoint:"
echo ""
echo "  curl http://localhost:8080/api/health"
echo "  curl http://localhost:8080/actuator/health"
echo "  curl http://localhost:8080/actuator/prometheus"
echo ""
echo -e "${GREEN}Links de acesso (dev local):${NC}"
echo ""
echo "  ┌─────────────────┬────────────────────────────────────┐"
echo "  │ Serviço         │ URL                                │"
echo "  ├─────────────────┼────────────────────────────────────┤"
echo "  │ API             │ http://localhost:8080               │"
echo "  │ Jaeger UI       │ http://localhost:16686              │"
echo "  │ Métricas (raw)  │ http://localhost:8080/actuator/prometheus │"
echo "  │ Health Check    │ http://localhost:8080/actuator/health     │"
echo "  └─────────────────┴────────────────────────────────────┘"
echo ""
echo ""

# ==============================================================================
# OPÇÃO 2: KUBERNETES (Kind) — Stack completa
# ==============================================================================

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  OPÇÃO 2: KUBERNETES (Kind) — Stack Completa${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Passo 1 - Deploy da infraestrutura (se ainda não fez):"
echo ""
echo "  cd /mnt/c/Users/avicente/Documents/battleship/k8s"
echo "  bash deploy.sh"
echo ""
echo "Passo 2 - Deploy do Prometheus, Grafana e Jaeger:"
echo ""
echo "  kubectl apply -f prometheus-config.yaml"
echo "  kubectl apply -f prometheus.yaml"
echo "  kubectl apply -f grafana.yaml"
echo "  kubectl apply -f jaeger.yaml"
echo ""
echo "Passo 3 - Aguardar pods ficarem prontos:"
echo ""
echo "  kubectl get pods -n battleship -w"
echo ""
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  PORT-FORWARD — Acessar serviços do K8s localmente${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Execute cada comando em uma aba separada do terminal:"
echo ""
echo "  # Jaeger UI + OTLP"
echo "  kubectl port-forward -n battleship svc/jaeger 16686:16686 4318:4318 4317:4317"
echo ""
echo "  # Prometheus"
echo "  kubectl port-forward -n battleship svc/prometheus 9090:9090"
echo ""
echo "  # Grafana"
echo "  kubectl port-forward -n battleship svc/grafana 3000:3000"
echo ""
echo "  # API (se não usar Ingress)"
echo "  kubectl port-forward -n battleship svc/battleship-api 8080:8080"
echo ""
echo ""

echo -e "${GREEN}Links de acesso (k8s com port-forward):${NC}"
echo ""
echo "  ┌─────────────────┬──────────────────────────────┬─────────────────────────┐"
echo "  │ Serviço         │ URL                          │ Credenciais             │"
echo "  ├─────────────────┼──────────────────────────────┼─────────────────────────┤"
echo "  │ API             │ http://localhost:8080         │ —                       │"
echo "  │ Jaeger UI       │ http://localhost:16686        │ —                       │"
echo "  │ Prometheus      │ http://localhost:9090         │ —                       │"
echo "  │ Grafana         │ http://localhost:3000         │ admin / admin           │"
echo "  │ Métricas (raw)  │ http://localhost:8080/actuator/prometheus │ —           │"
echo "  └─────────────────┴──────────────────────────────┴─────────────────────────┘"
echo ""
echo ""

# ==============================================================================
# SCRIPT AUTOMATIZADO DE PORT-FORWARD
# ==============================================================================

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  ATALHO: Abrir tudo de uma vez (background)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Cole este bloco para fazer port-forward de tudo em background:"
echo ""
echo '  # Parar port-forwards anteriores'
echo '  pkill -f "kubectl port-forward" 2>/dev/null || true'
echo ''
echo '  # Iniciar todos'
echo '  kubectl port-forward -n battleship svc/jaeger 16686:16686 4318:4318 4317:4317 &'
echo '  kubectl port-forward -n battleship svc/prometheus 9090:9090 &'
echo '  kubectl port-forward -n battleship svc/grafana 3000:3000 &'
echo '  kubectl port-forward -n battleship svc/battleship-api 8080:8080 &'
echo ''
echo '  echo "Todos os port-forwards ativos!"'
echo '  echo "Jaeger:     http://localhost:16686"'
echo '  echo "Prometheus: http://localhost:9090"'
echo '  echo "Grafana:    http://localhost:3000"'
echo '  echo "API:        http://localhost:8080"'
echo ""
echo ""

# ==============================================================================
# COMO VERIFICAR SE FUNCIONA
# ==============================================================================

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  COMO TESTAR${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Gerar traces:"
echo ""
echo "   curl http://localhost:8080/api/health"
echo "   curl http://localhost:8080/api/auth/registrar \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"nome\":\"teste123\",\"email\":\"teste@gmail.com\",\"senha\":\"senha@123\"}'"
echo ""
echo "2. Ver traces no Jaeger:"
echo "   → Abrir http://localhost:16686"
echo "   → Selecionar serviço: battleship-api"
echo "   → Clicar 'Find Traces'"
echo ""
echo "3. Ver métricas no Prometheus:"
echo "   → Abrir http://localhost:9090"
echo "   → Query: http_server_requests_seconds_count"
echo "   → Query: jvm_memory_used_bytes"
echo ""
echo "4. Ver dashboards no Grafana:"
echo "   → Abrir http://localhost:3000"
echo "   → Login: admin / admin"
echo "   → Explore → Selecionar datasource 'Prometheus'"
echo "   → Query: rate(http_server_requests_seconds_count[5m])"
echo ""
echo "5. Ver métricas raw do Spring Boot:"
echo "   curl http://localhost:8080/actuator/prometheus | head -50"
echo ""
echo ""

# ==============================================================================
# PARAR TUDO
# ==============================================================================

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PARAR TUDO${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  # Parar port-forwards"
echo "  pkill -f 'kubectl port-forward' 2>/dev/null"
echo ""
echo "  # Parar Jaeger local (docker)"
echo "  docker compose down"
echo ""
echo "  # Parar app Spring Boot"
echo "  # Ctrl+C no terminal ou:"
echo "  pkill -f 'spring-boot:run' 2>/dev/null"
echo ""
echo "  # Deletar cluster k8s inteiro"
echo "  kind delete cluster"
echo ""
