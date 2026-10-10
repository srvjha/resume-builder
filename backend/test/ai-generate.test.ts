import { NoObjectGeneratedError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const state = vi.hoisted(() => ({ written: [] as Record<string, unknown>[] }));
const generateObject = vi.hoisted(() => vi.fn());

vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateObject }));
vi.mock("../src/lib/ai/models.js", () => ({
  resolveModel: () => ({ model: {}, provider: "openai", modelId: "gpt-test" }),
}));
vi.mock("../src/modules/ai-keys/ai-keys.service.js", () => ({ loadUserAiKey: async () => null }));
vi.mock("../src/lib/logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("../src/db/index.js", () => {
  const query = (result: unknown) => {
    const q: Record<string, unknown> = {};
    for (const name of ["where", "returning"]) q[name] = () => q;
    q.then = (resolve: (v: unknown) => void) => resolve(result);
    return q;
  };
  return {
    db: {
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          state.written.push(v);
          return query([{ id: "run_1" }]);
        },
      }),
    },
  };
});

import { generateStructured } from "../src/lib/ai/generate.js";

const input = {
  userId: "user_1",
  step: "jd_parse" as const,
  tier: "fast" as const,
  schema: z.object({}),
  system: "",
  prompt: "",
};

beforeEach(() => {
  state.written = [];
  generateObject.mockReset();
});

describe("generateStructured", () => {
  it("records the tokens the model spent when its output does not match the schema", async () => {
    const usage = { inputTokens: 1200, outputTokens: 300, totalTokens: 1500, inputTokenDetails: {} };
    generateObject.mockRejectedValue(new NoObjectGeneratedError({ message: "no object", usage }));
    await expect(generateStructured(input)).rejects.toMatchObject({ code: "AI_FAILED" });
    expect(state.written[0]).toMatchObject({ status: "failed", inputTokens: 1200, outputTokens: 300 });
  });
});
