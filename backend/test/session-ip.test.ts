import { describe, expect, it } from "vitest";
import { withoutIp } from "../src/lib/session-ip.js";

describe("session IP", () => {
  it("drops the IP before a session is stored and keeps the rest", () => {
    expect(withoutIp({ ipAddress: "203.0.113.9", userAgent: "x" })).toEqual({ ipAddress: null, userAgent: "x" });
  });
});
