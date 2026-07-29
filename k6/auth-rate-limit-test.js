import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = 'http://battleship.local';

// Custom metrics
const rateLimited = new Counter('rate_limited_responses');
const successfulLogins = new Counter('successful_logins');
const failedLogins = new Counter('failed_logins');
const rateLimitHitRate = new Rate('rate_limit_hit_rate');

export const options = {
  scenarios: {
    hammer_login: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'hammerLogin',
    },
    health_check: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      exec: 'checkResponsive',
      startTime: '5s',
    },
  },
  thresholds: {
    rate_limited_responses: ['count>0'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function hammerLogin() {
  const payload = JSON.stringify({
    username: 'ratelimit_test_user',
    password: 'WrongPassword123!',
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

  if (res.status === 429) {
    rateLimited.add(1);
    rateLimitHitRate.add(true);

    check(res, {
      'rate limited response received (429)': (r) => r.status === 429,
    });
  } else if (res.status === 400 || res.status === 401) {
    failedLogins.add(1);
    rateLimitHitRate.add(false);

    check(res, {
      'login rejected (invalid credentials)': (r) => r.status === 400 || r.status === 401,
    });
  } else if (res.status === 200) {
    successfulLogins.add(1);
    rateLimitHitRate.add(false);
  } else {
    rateLimitHitRate.add(false);

    check(res, {
      'unexpected status': (r) => r.status === 429 || r.status === 400 || r.status === 401 || r.status === 200,
    });
  }

  // No sleep - we want to hammer the endpoint as fast as possible
}

export function checkResponsive() {
  // Verify the application remains responsive while rate limiting is active
  const res = http.get(`${BASE_URL}/api/health`);

  check(res, {
    'app is still responsive (status 200)': (r) => r.status === 200,
    'app responds within 2s': (r) => r.timings.duration < 2000,
  });

  sleep(2);
}
