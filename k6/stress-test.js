import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = 'http://battleship.local';

// Custom metrics
const lobbyRequests = new Counter('lobby_requests');
const createGameRequests = new Counter('create_game_requests');
const viewGameRequests = new Counter('view_game_requests');
const lobbyDuration = new Trend('lobby_duration', true);
const createGameDuration = new Trend('create_game_duration', true);
const viewGameDuration = new Trend('view_game_duration', true);
const endpointFailRate = new Rate('endpoint_fail_rate');

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp to 100 VUs over 1 minute
    { duration: '2m', target: 100 },   // Sustain 100 VUs for 2 minutes
    { duration: '30s', target: 0 },    // Ramp down over 30s
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.10'],
    lobby_duration: ['p(95)<800'],
    create_game_duration: ['p(95)<1000'],
    view_game_duration: ['p(95)<800'],
    endpoint_fail_rate: ['rate<0.10'],
  },
};

export function setup() {
  const uniqueId = Date.now();
  const username = `stresstest_${uniqueId}`;
  const registerPayload = JSON.stringify({
    nome: username,
    email: `stresstest_${uniqueId}@gmail.com`,
    password: 'Test123!',
  });

  const headers = { headers: { 'Content-Type': 'application/json' } };

  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    registerPayload,
    headers
  );

  check(registerRes, {
    'register status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  let token;
  if (registerRes.status === 200 || registerRes.status === 201) {
    const body = JSON.parse(registerRes.body);
    token = body.token;
  } else {
    const loginPayload = JSON.stringify({
      username: username,
      password: 'Test123!',
    });
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, headers);
    const body = JSON.parse(loginRes.body);
    token = body.token;
  }

  // Create a game during setup to have a valid game ID for view requests
  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const createRes = http.post(`${BASE_URL}/api/jogos`, '{}', authHeaders);
  let gameId = null;
  if (createRes.status === 200 || createRes.status === 201) {
    const gameBody = JSON.parse(createRes.body);
    gameId = gameBody.id;
  }

  return { token: token, gameId: gameId };
}

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  const rand = Math.random();

  if (rand < 0.6) {
    // 60% - GET lobby
    const res = http.get(`${BASE_URL}/api/jogos/lobby`, params);
    lobbyRequests.add(1);
    lobbyDuration.add(res.timings.duration);

    const success = check(res, {
      'lobby status is 200': (r) => r.status === 200,
    });
    endpointFailRate.add(!success);

  } else if (rand < 0.8) {
    // 20% - POST create game
    const res = http.post(`${BASE_URL}/api/jogos`, '{}', params);
    createGameRequests.add(1);
    createGameDuration.add(res.timings.duration);

    const success = check(res, {
      'create game status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
    endpointFailRate.add(!success);

  } else {
    // 20% - GET game status
    if (data.gameId) {
      const res = http.get(`${BASE_URL}/api/jogos/${data.gameId}`, params);
      viewGameRequests.add(1);
      viewGameDuration.add(res.timings.duration);

      const success = check(res, {
        'view game status is 200': (r) => r.status === 200,
      });
      endpointFailRate.add(!success);
    } else {
      const res = http.get(`${BASE_URL}/api/jogos/lobby`, params);
      viewGameRequests.add(1);
      viewGameDuration.add(res.timings.duration);

      const success = check(res, {
        'fallback lobby status is 200': (r) => r.status === 200,
      });
      endpointFailRate.add(!success);
    }
  }

  sleep(0.5);
}
