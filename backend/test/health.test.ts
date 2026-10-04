import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dbUp: true, compilerUp: true }));
vi.mock("../src/db/index.js", () => ({
  db: { execute: () => (mocks.dbUp ? Promise.resolve([]) : Promise.reject(new Error("down"))) },
}));
vi.mock("../src/modules/admin/admin.service.js", () => ({
  compilerHealth: async () => ({ mode: "service", ok: mocks.compilerUp, latencyMs: 1 }),
}));

const { app } = await import("../src/app.js");
let base = "";
const server = app.listen(0);
beforeAll(() => {
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe("/health/deep", () => {
  it("is ok when Postgres and the compiler answer", async () => {
    const res = await fetch(`${base}/health/deep`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: true, compiler: true });
  });

  it("answers 503 and names the part that is down", async () => {
    mocks.dbUp = false;
    const res = await fetch(`${base}/health/deep`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "degraded", database: false, compiler: true });
    mocks.dbUp = true;
  });
});
