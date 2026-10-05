import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

// ponytail: counts live in this process's memory, which is exact while one API process runs.
// Running several API processes needs a shared store (a Postgres table) so their counts add up.
function limiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Signed-in users are limited per account, everyone else per IP.
    keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? "unknown"),
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again in a minute." } });
    },
  });
}

const minute = 60_000;

export const apiLimiter = limiter(minute, 300);
export const publicLimiter = limiter(minute, 120);
export const compileLimiter = limiter(minute, 30);
export const aiLimiter = limiter(minute, 10);
export const atsLimiter = limiter(10 * minute, 10);
// Slows anyone guessing promo codes.
export const redeemLimiter = limiter(10 * minute, 10);
