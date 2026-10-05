import { beforeEach, describe, expect, it, vi } from "vitest";

// A Drizzle-like query: every builder method returns itself, and awaiting it gives `result`.
const query = (result: unknown, fail?: Error) => {
  const q: Record<string, unknown> = {};
  for (const name of ["values", "onConflictDoNothing", "returning", "set", "where", "from", "limit", "orderBy"])
    q[name] = () => q;
  q.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => (fail ? reject(fail) : resolve(result));
  return q;
};

const state = vi.hoisted(() => ({ committed: false, updateFails: false, calls: [] as string[] }));

vi.mock("../src/db/index.js", () => {
  const tx = {
    insert: () => {
      state.calls.push("tx.insert");
      return query([{ id: "evt" }]);
    },
    update: () => {
      state.calls.push("tx.update");
      return query(undefined, state.updateFails ? new Error("database down") : undefined);
    },
    select: () => query([]),
  };
  const db = {
    // A real transaction rolls back on throw; here a failure simply never commits.
    transaction: async (run: (t: typeof tx) => Promise<unknown>) => {
      const result = await run(tx);
      state.committed = true;
      return result;
    },
    insert: () => {
      state.calls.push("db.insert");
      return query([]);
    },
  };
  return { db };
});
vi.mock("../src/lib/analytics.js", () => ({ track: vi.fn() }));

import { handleRazorpayEvent } from "../src/modules/billing/webhooks.js";

const failed = {
  event: "payment.failed",
  payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
};

beforeEach(() => {
  state.committed = false;
  state.updateFails = false;
  state.calls = [];
});

describe("Razorpay webhooks", () => {
  it("records the event id inside the same transaction as its effects", async () => {
    await handleRazorpayEvent(failed, "evt_1");
    expect(state.calls).toEqual(["tx.insert", "tx.update"]);
    expect(state.committed).toBe(true);
  });

  it("fails the whole delivery when processing fails, so Razorpay retries it", async () => {
    state.updateFails = true;
    await expect(handleRazorpayEvent(failed, "evt_2")).rejects.toThrow("database down");
    expect(state.calls).toEqual(["tx.insert", "tx.update"]);
    expect(state.committed).toBe(false);
  });
});
