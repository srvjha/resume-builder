import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { aiStructuredOutput } from "../src/modules/suggestions/suggestions.schemas.js";
import { resumeContentSchema } from "../src/schemas/resume-content.js";

const op = (items: string[] | null) => ({
  summary: "s",
  operations: [
    { type: "update_skills", targetId: "g1", text: null, hidden: null, orderedIds: null, items, reason: "r" },
  ],
});

describe("aiStructuredOutput", () => {
  it("clamps skill items to the resume schema limits so an over-long answer still applies", () => {
    const long = Array.from({ length: 60 }, (_, i) => `skill ${i} ${"x".repeat(80)}`);
    const { operations } = aiStructuredOutput.parse(op(long));
    const items = operations[0]!.items!;
    expect(items).toHaveLength(40);
    const group = { id: "g1", name: "Languages", items };
    const section = { id: "s1", type: "skills", title: "Skills", hidden: false, groups: [group] };
    expect(resumeContentSchema.safeParse({ basics: { name: "A" }, sections: [section] }).success).toBe(true);
  });

  it("still converts to the JSON schema the model is asked to follow", () => {
    expect(() => zodSchema(aiStructuredOutput)).not.toThrow();
    expect(zodSchema(aiStructuredOutput).jsonSchema).toHaveProperty("properties.operations");
  });

  it("keeps null items as null", () => {
    expect(aiStructuredOutput.parse(op(null)).operations[0]!.items).toBeNull();
  });
});
