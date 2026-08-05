#!/bin/bash
# Import the complete dashboard to Grafana K8s via API
DASHBOARD_FILE="/mnt/c/Users/avicente/Documents/battleship/grafana/dashboards/battleship-completo.json"

# Wrap the dashboard JSON in the import envelope
PAYLOAD=$(python3 -c "
import json, sys
with open('$DASHBOARD_FILE') as f:
    dashboard = json.load(f)
dashboard['id'] = None
payload = {
    'dashboard': dashboard,
    'overwrite': True,
    'folderId': 0
}
print(json.dumps(payload))
")

# Import via Grafana API (anonymous access is Viewer, need admin)
RESULT=$(curl -s -X POST http://grafana.local/api/dashboards/db \
    -H "Content-Type: application/json" \
    -u admin:admin \
    -d "$PAYLOAD")

echo "$RESULT"
