import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://172.20.128.1:8080";

const rateLimited = new Counter("rate_limited_responses");
const normalResponses = new Counter("normal_responses");
const rateLimitHitRate = new Rate("rate_limit_hit_rate");

export const options = {
  scenarios: {
    hammer_login: {
      executor: "constant-vus",
      vus: 20,
      duration: "30s",
      exec: "hammerLogin",
    },
    health_check: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      exec: "checkHealth",
      startTime: "3s",
    },
  },
};

export function hammerLogin() {
  const payload = JSON.stringify({
    username: "ratelimit_test_user",
    password: "WrongPassword123!",
  });
  const params = { headers: { "Content-Type": "application/json" } };
  const res = http.post(BASE_URL + "/api/auth/login", payload, params);

  if (res.status === 429) {
    rateLimited.add(1);
    rateLimitHitRate.add(true);
    check(res, { "rate limited 429": (r) => r.status === 429 });
  } else {
    normalResponses.add(1);
    rateLimitHitRate.add(false);
    check(res, { "normal response": (r) => r.status !== 429 });
  }
}

export function checkHealth() {
  const res = http.get(BASE_URL + "/api/health");
  check(res, {
    "app responsive 200": (r) => r.status === 200,
    "response under 2s": (r) => r.timings.duration < 2000,
  });
  sleep(2);
}
