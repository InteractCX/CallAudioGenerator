import test from "node:test";
import assert from "node:assert/strict";
import { createGenerationRateLimiter } from "../src/rate-limit.js";

function responseRecorder() {
  return {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("limits audio generation requests per client IP and returns a retry delay", () => {
  const rateLimiter = createGenerationRateLimiter({ maxRequests: 1, windowMs: 60_000 });
  let allowedRequests = 0;
  const next = () => { allowedRequests += 1; };

  rateLimiter({ ip: "192.0.2.1" }, responseRecorder(), next);
  const blockedResponse = responseRecorder();
  rateLimiter({ ip: "192.0.2.1" }, blockedResponse, next);

  assert.equal(allowedRequests, 1);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.headers["Retry-After"], "60");
  assert.match(blockedResponse.body.error, /Too many audio generation requests/);
});

test("tracks different client IPs independently", () => {
  const rateLimiter = createGenerationRateLimiter({ maxRequests: 1, windowMs: 60_000 });
  let allowedRequests = 0;
  const next = () => { allowedRequests += 1; };

  rateLimiter({ ip: "192.0.2.1" }, responseRecorder(), next);
  rateLimiter({ ip: "192.0.2.2" }, responseRecorder(), next);

  assert.equal(allowedRequests, 2);
});
