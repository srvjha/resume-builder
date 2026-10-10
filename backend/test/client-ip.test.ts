import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { clientIp } from "../src/middleware/rate-limit.js";

const secret = "s".repeat(64);
const request = (headers: Record<string, string>) =>
  ({ ip: "76.76.21.1", get: (name: string) => headers[name.toLowerCase()] }) as unknown as Request;

describe("client IP for rate limits", () => {
  it("uses the visitor's IP when the frontend's server vouches for it", () => {
    const req = request({ "x-shortlist-proxy": secret, "x-shortlist-client-ip": "203.0.113.9" });
    expect(clientIp(req, secret)).toBe("203.0.113.9");
  });

  it("ignores a forwarded IP without the right secret, so callers can't pick their own limit", () => {
    expect(clientIp(request({ "x-shortlist-client-ip": "203.0.113.9" }), secret)).toBe("76.76.21.1");
    const wrong = request({ "x-shortlist-proxy": "x".repeat(64), "x-shortlist-client-ip": "203.0.113.9" });
    expect(clientIp(wrong, secret)).toBe("76.76.21.1");
  });

  it("falls back to the connection IP when no secret is configured", () => {
    const req = request({ "x-shortlist-proxy": secret, "x-shortlist-client-ip": "203.0.113.9" });
    expect(clientIp(req, undefined)).toBe("76.76.21.1");
  });
});
