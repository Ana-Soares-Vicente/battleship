#!/bin/bash
echo "=== battleship_matches_finished_total labels ==="
curl -s 'http://prometheus.local/api/v1/query?query=battleship_matches_finished_total' | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data['data']['result']:
    print(r['metric'])
    print('  Value:', r['value'][1])
"

echo ""
echo "=== http_server_requests (POST /api/jogos status=201) ==="
curl -s 'http://prometheus.local/api/v1/query?query=http_server_requests_seconds_count%7Buri%3D%22%2Fapi%2Fjogos%22%2Cmethod%3D%22POST%22%2Cstatus%3D%22201%22%7D' | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data['data']['result']:
    print(r['metric'])
    print('  Value:', r['value'][1])
"

echo ""
echo "=== All unique application labels ==="
curl -s 'http://prometheus.local/api/v1/label/application/values' | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('data', []))
"
