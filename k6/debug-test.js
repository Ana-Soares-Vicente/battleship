import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://battleship.local';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const username = `k6_${uniqueId}`;
  const headers = { headers: { 'Content-Type': 'application/json' } };

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

  console.log(`Register: status=${registerRes.status} body=${registerRes.body}`);

  if (registerRes.status === 200 || registerRes.status === 201) {
    const body = JSON.parse(registerRes.body);
    return { token: body.token };
  }

  return { token: null };
}

export default function (data) {
  if (!data.token) {
    console.error('No token');
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

  // Log first few responses to see what's happening
  if (__ITER < 3) {
    console.log(`Lobby: status=${res.status} body=${res.body.substring(0, 200)}`);
  }

  check(res, {
    'lobby status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
