import { describe, expect, it } from "vitest";
import { assertNotGuest } from "../src/modules/billing/billing.service.js";

const executor = (rows: { isAnonymous: boolean }[]) =>
  ({ select: () => ({ from: () => ({ where: async () => rows }) }) }) as unknown as Parameters<
    typeof assertNotGuest
  >[1];

describe("assertNotGuest", () => {
  it("refuses a guest account", async () => {
    await expect(assertNotGuest("u", executor([{ isAnonymous: true }]))).rejects.toMatchObject({ status: 403 });
  });

  it("lets a real account through", async () => {
    await expect(assertNotGuest("u", executor([{ isAnonymous: false }]))).resolves.toBeUndefined();
  });
});
