import { describe, expect, it, vi } from "vitest";

// Port 9 has no listener, so the remote compile fails to connect the way a dead compiler service does.
vi.mock("../src/config/env.js", async (importOriginal) => ({
  env: {
    ...(await importOriginal<typeof import("../src/config/env.js")>()).env,
    COMPILER_URL: "http://127.0.0.1:9",
    COMPILE_TIMEOUT_MS: 20_000,
  },
}));
vi.mock("../src/lib/storage.js", () => ({ storage: { get: async () => undefined, put: async () => {} } }));

const { compileTex } = await import("../src/lib/latex/compile.js");

describe("unreachable compiler", () => {
  it("reports COMPILER_UNAVAILABLE instead of an unhandled network error", async () => {
    await expect(compileTex("\\documentclass{article}\\begin{document}x\\end{document}")).rejects.toMatchObject({
      status: 502,
      code: "COMPILER_UNAVAILABLE",
    });
  });
});
