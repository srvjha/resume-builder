import { describe, expect, it } from "vitest";
import {
  applyOperations,
  factText,
  isApplicable,
  type Operation,
  unverifiedTerms,
} from "../src/modules/suggestions/operations.js";
import { resumeContentSchema } from "../src/schemas/resume-content.js";

const content = resumeContentSchema.parse({
  basics: { name: "S" },
  sections: [
    {
      id: "ex",
      type: "experience",
      title: "Experience",
      entries: [
        {
          id: "e1",
          organization: "Razorpay",
          role: "SDE Intern",
          bullets: [
            { id: "b1", text: "Built payouts API in Go with Redis, cutting latency by 40%" },
            { id: "b2", text: "Wrote tests" },
          ],
        },
      ],
    },
    {
      id: "sk",
      type: "skills",
      title: "Skills",
      groups: [{ id: "g1", name: "Languages", items: ["Go", "TypeScript"] }],
    },
  ],
});
const op = (fields: object) => ({ id: "x", reason: "", flags: [], ...fields }) as Operation;

describe("isApplicable", () => {
  it("accepts a full reorder and rejects a partial one", () => {
    expect(isApplicable(content, { type: "reorder", parentId: "e1", orderedIds: ["b2", "b1"] })).toBe(true);
    expect(isApplicable(content, { type: "reorder", parentId: "e1", orderedIds: ["b1"] })).toBe(false);
  });

  it("rejects unknown targets", () => {
    expect(isApplicable(content, { type: "update_bullet", bulletId: "nope", text: "x" })).toBe(false);
    expect(isApplicable(content, { type: "set_hidden", targetId: "nope", hidden: true })).toBe(false);
  });
});

describe("applyOperations", () => {
  it("applies edits without mutating the input", () => {
    const next = applyOperations(content, [
      op({ type: "update_bullet", bulletId: "b2", text: "Wrote **unit tests**" }),
      op({ type: "reorder", parentId: "sections", orderedIds: ["sk", "ex"] }),
      op({ type: "set_hidden", targetId: "b1", hidden: true }),
    ]);
    expect(next.sections.map((s) => s.id)).toEqual(["sk", "ex"]);
    const experience = next.sections[1];
    if (experience?.type !== "experience") throw new Error("unexpected");
    expect(experience.entries[0]!.bullets.map((b) => [b.text, b.hidden])).toEqual([
      ["Built payouts API in Go with Redis, cutting latency by 40%", true],
      ["Wrote **unit tests**", false],
    ]);
    expect(content.sections[0]!.id).toBe("ex");
  });
});

describe("unverifiedTerms", () => {
  const facts = [factText(content)];

  it("passes rephrasings that only use known facts", () => {
    expect(unverifiedTerms("Improved latency by 40% on a Go payouts API using Redis", facts)).toEqual([]);
  });

  it("flags invented tools, companies and numbers", () => {
    expect(unverifiedTerms("Scaled Kafka pipelines to 10M events/day at Stripe", facts)).toEqual([
      "Kafka",
      "10M",
      "Stripe",
    ]);
    expect(unverifiedTerms("Reduced p99 latency by 40%", facts)).toEqual(["p99"]);
  });
});

describe("add_bullet", () => {
  const bullets = (c: typeof content) => {
    const section = c.sections[0];
    return section?.type === "experience" ? section.entries[0]!.bullets.map((b) => b.text) : [];
  };

  it("splits a bullet into two, keeping the order the AI gave", () => {
    const next = applyOperations(content, [
      op({ type: "update_bullet", bulletId: "b1", text: "Built payouts API in Go with Redis" }),
      op({ id: "n1", type: "add_bullet", afterBulletId: "b1", text: "Cut payouts latency by 40%" }),
      op({ id: "n2", type: "add_bullet", afterBulletId: "b1", text: "Cached hot reads in Redis" }),
    ]);
    expect(bullets(next)).toEqual([
      "Built payouts API in Go with Redis",
      "Cut payouts latency by 40%",
      "Cached hot reads in Redis",
      "Wrote tests",
    ]);
    expect(resumeContentSchema.safeParse(next).success).toBe(true);
  });

  it("only adds after a bullet that exists", () => {
    expect(isApplicable(content, { type: "add_bullet", afterBulletId: "b1", text: "Led reviews" })).toBe(true);
    expect(isApplicable(content, { type: "add_bullet", afterBulletId: "nope", text: "Led reviews" })).toBe(false);
    expect(isApplicable(content, { type: "add_bullet", afterBulletId: "b1", text: " " })).toBe(false);
  });
});
