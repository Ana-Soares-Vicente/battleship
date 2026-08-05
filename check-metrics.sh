#!/bin/bash
echo "=== Prometheus Targets ==="
curl -s http://prometheus.local/api/v1/targets/metadata | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('Metrics available:', len(data.get('data', [])))
" 2>/dev/null

echo ""
echo "=== Checking key metrics ==="
for metric in "http_server_requests_seconds_count" "battleship_matches_finished_total" "battleship_shots_hit_total" "battleship_matches_active" "spring_data_repository_invocations_seconds_count"; do
    result=$(curl -s "http://prometheus.local/api/v1/query?query=${metric}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('data', {}).get('result', [])
print(len(results))
" 2>/dev/null)
    echo "  $metric: $result timeseries"
done

echo ""
echo "=== Checking Prometheus config ==="
curl -s http://prometheus.local/api/v1/status/config | python3 -c "
import sys, json
data = json.load(sys.stdin)
config = data.get('data', {}).get('yaml', '')
for line in config.split('\n'):
    if 'target' in line or 'job_name' in line or 'metrics_path' in line:
        print(line)
" 2>/dev/null

echo ""
echo "=== Direct actuator test ==="
curl -s http://battleship.local/actuator/prometheus 2>&1 | head -5
