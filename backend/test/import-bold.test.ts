import { describe, expect, it } from "vitest";
import { applyBold } from "../src/modules/imports/extraction.js";
import { resumeContentSchema } from "../src/schemas/resume-content.js";

const content = (bullet: string, summary = "") =>
  resumeContentSchema.parse({
    basics: { name: "Aarav Sharma" },
    sections: [
      { id: "sum", type: "summary", title: "Summary", text: summary },
      {
        id: "exp",
        type: "experience",
        title: "Experience",
        entries: [{ id: "e1", organization: "Razorpay", role: "SDE Intern", bullets: [{ id: "b1", text: bullet }] }],
      },
    ],
  });

const bullet = (result: ReturnType<typeof applyBold>) =>
  result.sections.flatMap((s) => ("entries" in s ? s.entries : []))[0]!.bullets[0]!.text;

describe("bold from the PDF", () => {
  it("wraps the PDF's bold words in bullets and summaries", () => {
    const result = applyBold(content("Cut p99 latency by 40% with Redis", "Backend engineer who loves Go"), ["40%", "Go"]);
    expect(bullet(result)).toBe("Cut p99 latency by **40%** with Redis");
    expect(result.sections[0]).toMatchObject({ text: "Backend engineer who loves **Go**" });
  });

  it("matches whole words only and leaves text the AI already bolded", () => {
    const result = applyBold(content("Built **Go** services at Google"), ["Go"]);
    expect(bullet(result)).toBe("Built **Go** services at Google");
  });

  it("prefers the longer phrase when one contains another", () => {
    expect(bullet(applyBold(content("Shipped on Apache Kafka"), ["Kafka", "Apache Kafka"]))).toBe(
      "Shipped on **Apache Kafka**",
    );
  });
});
