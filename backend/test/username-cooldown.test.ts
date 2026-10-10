import { describe, expect, it } from "vitest";
import { usernameCooldownEnd } from "../src/modules/users/usernames.js";

const day = 24 * 60 * 60 * 1000;

describe("usernameCooldownEnd", () => {
  it("lets a user who never renamed set a username", () => {
    expect(usernameCooldownEnd(null)).toBeNull();
  });

  it("blocks a rename within 30 days and says when it opens", () => {
    const changedAt = new Date("2026-01-01T00:00:00Z");
    const end = usernameCooldownEnd(changedAt, new Date(changedAt.getTime() + 10 * day));
    expect(end?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("allows a rename after 30 days", () => {
    const changedAt = new Date("2026-01-01T00:00:00Z");
    expect(usernameCooldownEnd(changedAt, new Date(changedAt.getTime() + 31 * day))).toBeNull();
  });
});
