import { describe, expect, it, vi } from "vitest";

// A Drizzle-like query: every builder method returns itself, and awaiting it gives `result`.
const query = (result: unknown) => {
  const q: Record<string, unknown> = {};
  for (const name of ["values", "returning", "from", "where", "limit", "orderBy"]) q[name] = () => q;
  q.then = (resolve: (v: unknown) => void) => resolve(result);
  return q;
};

vi.mock("../src/db/index.js", () => ({
  db: { select: () => query([]), insert: () => query([{ id: "job_1" }]) },
}));
vi.mock("../src/lib/analytics.js", () => ({ track: vi.fn() }));
const generateStructured = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/ai/generate.js", () => ({ generateStructured }));

import { createJob } from "../src/modules/jobs/jobs.service.js";

describe("job creation", () => {
  it("meters the requirement parse against the job quota", async () => {
    generateStructured.mockResolvedValue({ data: { company: null, role: null, requirements: [] }, runId: "run_1" });
    await createJob("user_1", { rawText: "Backend engineer. ".repeat(20) });
    expect(generateStructured).toHaveBeenCalledWith(expect.objectContaining({ step: "jd_parse", quota: "job" }));
  });
});
