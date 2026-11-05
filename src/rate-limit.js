const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 10;

export function createGenerationRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
} = {}) {
  const requestsByIp = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requestsByIp) {
      if (record.resetAt <= now) requestsByIp.delete(ip);
    }
  }, windowMs);
  cleanup.unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip;
    let record = requestsByIp.get(ip);

    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs };
      requestsByIp.set(ip, record);
    }

    if (record.count >= maxRequests) {
      res.set("Retry-After", String(Math.ceil((record.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Too many audio generation requests. Try again later." });
    }

    record.count += 1;
    next();
  };
}
