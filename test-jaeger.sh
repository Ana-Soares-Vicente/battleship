#!/bin/bash
curl -s http://battleship.local/api/health > /dev/null
curl -s -X POST http://battleship.local/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"1234@"}' > /dev/null
sleep 5
echo "=== Jaeger Services ==="
curl -s http://jaeger.local/api/services
