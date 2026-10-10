import { describe, expect, it } from "vitest";
import { createShareLinkBody } from "../src/modules/share-links/share-links.schemas.js";

describe("share link passwords", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(createShareLinkBody.safeParse({ password: "1234567" }).success).toBe(false);
    expect(createShareLinkBody.safeParse({ contactPassword: "1234567" }).success).toBe(false);
  });

  it("accepts 8 characters", () => {
    expect(createShareLinkBody.safeParse({ password: "12345678" }).success).toBe(true);
  });
});
