import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://battleship.local';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp-up: 0 to 20 VUs
    { duration: '1m', target: 20 },    // Sustained: 20 VUs for 1 minute
    { duration: '10s', target: 50 },   // Spike: 20 to 50 VUs
    { duration: '30s', target: 50 },   // Peak: 50 VUs for 30s
    { duration: '20s', target: 0 },    // Ramp-down: 50 to 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  // Use timestamp + random to guarantee unique username every run
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const username = `k6_${uniqueId}`;
  const headers = { headers: { 'Content-Type': 'application/json' } };

  // Register always succeeds with unique username
  const registerPayload = JSON.stringify({
    nome: username,
    email: `${username}@gmail.com`,
    password: 'Test123!',
  });

  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    registerPayload,
    headers
  );

  const regOk = check(registerRes, {
    'register status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  if (regOk) {
    // Register returns token directly - no need for separate login
    const body = JSON.parse(registerRes.body);
    console.log(`Setup OK: user=${username}, token length=${body.token.length}`);
    return { token: body.token };
  }

  // If register failed, log the error
  console.error(`Register failed: status=${registerRes.status} body=${registerRes.body}`);
  return { token: null };
}

export default function (data) {
  if (!data.token) {
    console.error('No token available - setup failed');
    sleep(1);
    return;
  }

  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.get(`${BASE_URL}/api/jogos/lobby`, params);

  check(res, {
    'lobby status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
