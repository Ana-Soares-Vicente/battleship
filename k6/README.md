# Battleship - k6 Load Tests

Load and stress testing scripts for the Battleship Spring Boot API using [k6](https://k6.io/).

## Prerequisites

The API must be accessible at `http://battleship.local`. Ensure your kind cluster is running and the NGINX Ingress is routing traffic to the 2 replicas.

## Installing k6

### Windows (Chocolatey)

```powershell
choco install k6
```

### Windows (Download binary)

Download from https://github.com/grafana/k6/releases and add to your PATH.

### WSL / Linux (apt)

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### macOS (Homebrew)

```bash
brew install k6
```

## Running the Tests

### Load Test (Standard)

Simulates normal traffic patterns with ramp-up, sustained load, spike, and ramp-down.

```bash
k6 run load-test.js
```

### Stress Test

Pushes the system to 100 VUs with a mix of API endpoints to find breaking points.

```bash
k6 run stress-test.js
```

### Auth Rate Limit Test

Validates that rate limiting is working on authentication endpoints.

```bash
k6 run auth-rate-limit-test.js
```

### Run with JSON output (for analysis)

```bash
k6 run --out json=results.json load-test.js
```

### Run with custom base URL

```bash
k6 run -e BASE_URL=http://localhost:8080 load-test.js
```

> Note: To use the `BASE_URL` env override, replace the const in the scripts with:
> `const BASE_URL = __ENV.BASE_URL || 'http://battleship.local';`

## What to Look For in Results

### Key Metrics

| Metric | Description | What to watch |
|--------|-------------|---------------|
| `http_req_duration` | Response time | p(95) should stay under thresholds |
| `http_req_failed` | Failed request rate | Should be below 5% under normal load |
| `http_reqs` | Total requests/sec | Throughput capacity of the system |
| `vus` | Active virtual users | Correlate with response times |
| `iterations` | Completed iterations | Should increase linearly with VUs |

### Signs of Problems

- **p(95) latency increasing**: The application is saturating. Check CPU/memory on pods.
- **Error rate spiking**: Pods may be OOMKilled or connections being dropped.
- **Flat throughput with increasing VUs**: Bottleneck reached (DB connections, thread pool, etc).
- **429 responses NOT appearing in rate limit test**: Rate limiting is not configured.
- **503 responses**: NGINX Ingress cannot reach backends — pods might be crashing.

### Expected Thresholds

| Test | Metric | Threshold |
|------|--------|-----------|
| Load Test | `http_req_duration` p(95) | < 500ms |
| Load Test | `http_req_failed` rate | < 5% |
| Stress Test | `http_req_duration` p(95) | < 1000ms |
| Stress Test | `http_req_duration` p(99) | < 2000ms |
| Stress Test | `http_req_failed` rate | < 10% |
| Stress Test | `endpoint_fail_rate` | < 10% |
| Rate Limit | `rate_limited_responses` count | > 0 (rate limiting is active) |
| Rate Limit | `http_req_duration` p(95) | < 2000ms (app stays responsive) |

## Architecture Notes

- The API runs behind NGINX Ingress on a kind cluster with **2 replicas**
- k6 will naturally hit both replicas through the Ingress load balancer
- JWT tokens from setup are shared across all VUs in a test run
- The stress test creates games during the run, so the database will accumulate test data

## Cleanup

After running tests, you may want to clean up test users and games from the database:

```sql
DELETE FROM jogos WHERE criador LIKE 'loadtest_%' OR criador LIKE 'stresstest_%';
DELETE FROM users WHERE username LIKE 'loadtest_%' OR username LIKE 'stresstest_%';
```
