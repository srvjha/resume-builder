import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// "Cookie: user=<id>" stands in for a signed-in session; no cookie means signed out.
const mocks = vi.hoisted(() => ({ lookups: 0 }));
vi.mock("../src/lib/auth.js", () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        mocks.lookups++;
        const id = /user=(\w+)/.exec(headers.get("cookie") ?? "")?.[1];
        return id ? { user: { id, email: `${id}@example.com` }, session: { id: `s-${id}` } } : null;
      },
    },
  },
}));
vi.mock("../src/db/index.js", () => ({
  // Thrown, not a rejected promise: the route's own error handling catches it and nothing is left unhandled.
  db: {
    select: () => {
      throw new Error("no database in this test");
    },
  },
}));

const { app } = await import("../src/app.js");
let base = "";
const server = app.listen(0);
beforeAll(() => {
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

// An unknown /v1 path still passes through the limiter, then answers 404, so no database is needed.
const hit = (cookie?: string) => fetch(`${base}/v1/no-such-thing`, { headers: cookie ? { cookie } : {} });
const statuses = async (n: number, cookie?: string) =>
  Promise.all(Array.from({ length: n }, () => hit(cookie).then((r) => r.status)));

describe("API rate limit", () => {
  it("gives each signed-in user their own allowance, even on one shared IP", async () => {
    const [a, b] = await Promise.all([statuses(250, "user=alice"), statuses(250, "user=bob")]);
    expect([...a, ...b].filter((s) => s === 429)).toHaveLength(0);
  });

  it("still limits signed-out visitors per IP", async () => {
    const results = await statuses(310);
    expect(results.filter((s) => s === 429).length).toBeGreaterThanOrEqual(10);
  });

  it("looks the session up once per request, even behind requireAuth", async () => {
    mocks.lookups = 0;
    await fetch(`${base}/v1/subscription`, { headers: { cookie: "user=carol" } });
    expect(mocks.lookups).toBe(1);
  });
});
