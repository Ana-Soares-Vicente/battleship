#!/bin/bash
BASE="http://172.20.128.1:8080/actuator/metrics"

echo "=== Per Repository ==="
for repo in JogoRepository TabuleiroRepository NavioRepository TiroRepository UsuarioRepository; do
  echo "--- $repo ---"
  curl -s "${BASE}/spring.data.repository.invocations?tag=repository:$repo"
  echo
done

echo ""
echo "=== JVM Memory Heap ==="
curl -s "${BASE}/jvm.memory.used?tag=area:heap"
echo ""
echo "=== JVM Memory Non-Heap ==="
curl -s "${BASE}/jvm.memory.used?tag=area:nonheap"
echo ""
echo "=== JVM Threads ==="
curl -s "${BASE}/jvm.threads.live"
echo ""
echo "=== Rate Limit 429 ==="
curl -s "${BASE}/http.server.requests?tag=status:429"
echo ""
echo "=== HikariCP Usage ==="
curl -s "${BASE}/hikaricp.connections.usage"
echo ""
echo "=== Process Uptime ==="
curl -s "${BASE}/process.uptime"
echo ""
echo "=== Application Started Time ==="
curl -s "${BASE}/application.started.time"
echo ""
