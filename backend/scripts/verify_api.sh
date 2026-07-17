#!/usr/bin/env bash
# Phase 3 Verification Checkpoint.
# Run from backend/:  bash scripts/verify_api.sh
# Boots the API, exercises every endpoint, shuts down. PASS = all sections
# print valid JSON and the 404 probe returns 404.
set -e
uvicorn app.main:app --port 8000 >/tmp/uvicorn.log 2>&1 &
SVPID=$!
trap "kill $SVPID 2>/dev/null" EXIT
sleep 3

echo "== /health =="
curl -sf localhost:8000/health | python3 -m json.tool | head -8

echo "== POST /simulate/step x2 (6000 learning steps) =="
curl -sf -X POST localhost:8000/simulate/step \
     -H "Content-Type: application/json" -d '{"n_steps": 3000}' >/dev/null
curl -sf -X POST localhost:8000/simulate/step \
     -H "Content-Type: application/json" -d '{"n_steps": 3000}' \
     | python3 -m json.tool | head -14

echo "== /metrics (downsampled history) =="
curl -sf "localhost:8000/metrics?max_points=5" \
     | python3 -c "import json,sys; d=json.load(sys.stdin); \
print(json.dumps(d['history']['series'][-1], indent=1))"

echo "== /customer/17/decision (Inspector payload) =="
curl -sf localhost:8000/customer/17/decision | python3 -m json.tool | head -25

echo "== /segments/distribution =="
curl -sf "localhost:8000/segments/distribution?policy=linucb" \
     | python3 -m json.tool | head -12

echo "== 404 handling =="
CODE=$(curl -s -o /dev/null -w "%{http_code}" localhost:8000/customer/99999/decision)
echo "customer 99999 -> $CODE"
[ "$CODE" = "404" ] && echo "PHASE 3 PASSED — proceed to Phase 4 (frontend)."
