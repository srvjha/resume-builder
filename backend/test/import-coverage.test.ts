import { describe, expect, it } from "vitest";
import type { ParsedResume } from "../src/modules/ats/parser/types.js";
import { restoreMissedLines } from "../src/modules/imports/coverage.js";
import { resumeContentSchema } from "../src/schemas/resume-content.js";

const content = () =>
  resumeContentSchema.parse({
    basics: { name: "Aarav Sharma" },
    sections: [
      {
        id: "skills",
        type: "skills",
        title: "Technical Skills",
        groups: [{ id: "g1", name: "Languages", items: ["Go", "TypeScript", "Python"] }],
      },
      {
        id: "exp",
        type: "experience",
        title: "Experience",
        entries: [
          {
            id: "e1",
            organization: "Razorpay",
            role: "SDE Intern",
            start: "2025-05",
            end: "2025-07",
            bullets: [{ id: "b1", text: "Cut p99 latency of the payouts API by 40% with Redis caching" }],
          },
          {
            id: "e2",
            organization: "E-Cell, IIT Delhi",
            role: "Tech Lead",
            start: "2023-08",
            end: "2025-04",
            bullets: [{ id: "b2", text: "Led a team of 6 building the registration platform" }],
          },
        ],
      },
    ],
  });

// What the rule-based parser reads from the PDF.
const parsed = (extra: string[] = []): ParsedResume => ({
  name: "Aarav Sharma",
  email: "aarav@example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru",
  links: [],
  jobs: [],
  readingOrderIssues: 0,
  sections: [
    { heading: "Technical Skills", kind: "skills", lines: ["Languages: Go, TypeScript, Python"] },
    {
      heading: "Experience",
      kind: "experience",
      lines: [
        "SDE Intern May 2025 – Jul 2025",
        "Razorpay Bengaluru",
        "• Cut p99 latency of the payouts API by 40% with Redis caching",
        "Tech Lead Aug 2023 – Apr 2025",
        "E-Cell, IIT Delhi New Delhi",
        "• Led a team of 6 building the registration platform",
        ...extra,
      ],
    },
  ],
});

const bullets = (result: ReturnType<typeof restoreMissedLines>, entryId: string) =>
  result.content.sections.flatMap((s) => ("entries" in s ? s.entries : [])).find((e) => e.id === entryId)!.bullets;

describe("import coverage check", () => {
  it("reports nothing when the AI kept every line, dates and skills included", () => {
    expect(restoreMissedLines(content(), parsed()).missed).toEqual([]);
  });

  it("restores a dropped bullet, hidden, under the entry it sat under", () => {
    const result = restoreMissedLines(content(), parsed(["• Set up CI/CD and monitoring for all club services"]));
    expect(result.missed).toEqual([{ text: "Set up CI/CD and monitoring for all club services", placed: true }]);
    expect(bullets(result, "e2").at(-1)).toMatchObject({
      text: "Set up CI/CD and monitoring for all club services",
      hidden: true,
    });
    expect(bullets(result, "e1")).toHaveLength(1);
  });

  it("fills contact details the AI left empty, and never changes the input", () => {
    const input = content();
    const result = restoreMissedLines(input, parsed());
    expect(result.content.basics).toMatchObject({ email: "aarav@example.com", phone: "+91 98765 43210" });
    expect(input.basics.email).toBeUndefined();
  });

  it("reports a line it can't place without inventing a spot for it", () => {
    const input = parsed();
    input.sections[0]!.lines.push("Frameworks: Node.js, Express, Django, Spring Boot");
    const result = restoreMissedLines(content(), input);
    expect(result.missed).toEqual([{ text: "Frameworks: Node.js, Express, Django, Spring Boot", placed: false }]);
    expect(JSON.stringify(result.content)).not.toContain("Django");
  });

  it("ignores template column labels", () => {
    expect(restoreMissedLines(content(), parsed(["Degree Institution Score Year"])).missed).toEqual([]);
  });
});
