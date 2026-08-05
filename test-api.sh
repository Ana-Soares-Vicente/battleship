#!/bin/bash
REG=$(curl -s -X POST http://battleship.local/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"player1\",\"password\":\"123456\"}")
echo "Register: $REG"

LOGIN=$(curl -s -X POST http://battleship.local/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"player1\",\"password\":\"123456\"}")
echo "Login: $LOGIN"

TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Token: ${TOKEN:0:30}..."

JOGO=$(curl -s -X POST http://battleship.local/api/jogos -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
echo "Jogo: $JOGO"

JOGO_ID=$(echo "$JOGO" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "Jogo ID: $JOGO_ID"

curl -s -X POST http://battleship.local/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"player2\",\"password\":\"123456\"}"
LOGIN2=$(curl -s -X POST http://battleship.local/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"player2\",\"password\":\"123456\"}")
TOKEN2=$(echo "$LOGIN2" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Token2: ${TOKEN2:0:30}..."

echo "=== ENTRAR ==="
curl -sv -X POST "http://battleship.local/api/jogos/${JOGO_ID}/entrar" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" 2>&1

echo ""
echo "=== LOGS ==="
kubectl logs -n battleship -l app=battleship-api --since=30s 2>&1 | grep -v WebSocket
