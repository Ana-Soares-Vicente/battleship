#!/bin/bash
BASE="http://172.20.128.1:8080/actuator/metrics/http.server.requests"

URIS=(
  "/api/auth/register"
  "/api/auth/login"
  "/api/jogos/lobby"
  "/api/jogos"
  "/api/jogos/{id}"
  "/api/jogos/{id}/atirar"
  "/api/jogos/{id}/posicionar-navios"
  "/api/jogos/{id}/entrar"
  "/api/jogos/{id}/minha-frota"
  "/api/jogos/{id}/meus-tiros"
  "/api/jogos/{id}/tiros-disponiveis"
  "/api/jogos/{id}/tiros-recebidos"
  "/api/jogos/{id}/navios-afundados-inimigo"
  "/api/jogos/{id}/revanche"
  "/actuator/health"
  "/actuator/prometheus"
)

echo "ENDPOINT | COUNT | TOTAL_TIME(s) | MAX(ms)"
echo "---------|-------|---------------|--------"

for uri in "${URIS[@]}"; do
  data=$(curl -s "${BASE}?tag=uri:${uri}")
  if echo "$data" | grep -q "COUNT"; then
    count=$(echo "$data" | grep -oP '"COUNT","value":\K[0-9.]+')
    total=$(echo "$data" | grep -oP '"TOTAL_TIME","value":\K[0-9.]+')
    max=$(echo "$data" | grep -oP '"MAX","value":\K[0-9.]+')
    if [ "$count" != "0.0" ] && [ -n "$count" ]; then
      avg_ms=$(echo "scale=2; $total / $count * 1000" | bc)
      max_ms=$(echo "scale=2; $max * 1000" | bc)
      echo "$uri | $count | avg=${avg_ms}ms | max=${max_ms}ms"
    fi
  fi
done

echo ""
echo "=== JVM Memory ==="
curl -s "http://172.20.128.1:8080/actuator/metrics/jvm.memory.used" | grep -oP '"statistic":"VALUE","value":\K[0-9.]+'
echo ""
echo "=== Process Uptime ==="
curl -s "http://172.20.128.1:8080/actuator/metrics/process.uptime" | grep -oP '"statistic":"VALUE","value":\K[0-9.]+'
echo ""
echo "=== Spring Data Repository Metrics ==="
curl -s "http://172.20.128.1:8080/actuator/metrics" | grep -oP '"spring\.data\.repository\.[^"]*"' | sort -u
