import { describe, expect, it } from "vitest";
import { normalizeCode, redeemProblem } from "../src/modules/promo-codes/promo-codes.service.js";

const now = new Date("2026-10-05T12:00:00Z");
const code = (fields: Partial<Parameters<typeof redeemProblem>[0] & object> = {}) => ({
  active: true,
  expiresAt: null,
  maxRedemptions: null,
  ...fields,
});

describe("promo codes", () => {
  it("matches codes however they are typed", () => {
    expect(normalizeCode("  placement100 ")).toBe("PLACEMENT100");
  });

  it("accepts an active, unexpired code with room left", () => {
    expect(redeemProblem(code(), 0, now)).toBeNull();
    expect(redeemProblem(code({ maxRedemptions: 100 }), 99, now)).toBeNull();
    expect(redeemProblem(code({ expiresAt: new Date("2026-10-06") }), 0, now)).toBeNull();
  });

  it("rejects unknown, inactive, expired and used-up codes", () => {
    expect(redeemProblem(undefined, 0, now)).toMatch(/doesn't exist/);
    expect(redeemProblem(code({ active: false }), 0, now)).toMatch(/no longer active/);
    expect(redeemProblem(code({ expiresAt: new Date("2026-10-05T11:59:59Z") }), 0, now)).toMatch(/expired/);
    expect(redeemProblem(code({ maxRedemptions: 100 }), 100, now)).toMatch(/fully used/);
  });
});
