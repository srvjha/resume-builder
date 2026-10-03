import { describe, expect, it } from "vitest";
import { parseProviderModels } from "../src/lib/ai/models.js";

describe("provider model lists", () => {
  it("keeps only OpenAI chat models, newest first", () => {
    const models = parseProviderModels("openai", {
      data: [
        { id: "gpt-5.4-mini", created: 2 },
        { id: "text-embedding-3-large", created: 3 },
        { id: "gpt-realtime", created: 4 },
        { id: "gpt-image-1", created: 5 },
        { id: "o4-mini", created: 1 },
        { id: "gpt-5.5", created: 6 },
        { id: "whisper-1", created: 7 },
      ],
    });
    expect(models.map((model) => model.id)).toEqual(["gpt-5.5", "gpt-5.4-mini", "o4-mini"]);
  });

  it("uses Anthropic display names", () => {
    expect(parseProviderModels("anthropic", { data: [{ id: "claude-sonnet-5", display_name: "Claude Sonnet 5" }] })).toEqual(
      [{ id: "claude-sonnet-5", name: "Claude Sonnet 5" }],
    );
  });
});
