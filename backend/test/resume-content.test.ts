import { describe, expect, it } from "vitest";
import { resumeContentSchema } from "../src/schemas/resume-content.js";
import { sampleResume } from "../src/templates/sample.js";

const withLink = (url: string) =>
  resumeContentSchema.safeParse({
    ...sampleResume,
    basics: { ...sampleResume.basics, links: [{ label: "Site", url }] },
  }).success;

describe("resume links", () => {
  it("allow only web and mail links", () => {
    expect(withLink("https://github.com/you")).toBe(true);
    expect(withLink("mailto:you@example.com")).toBe(true);
    for (const url of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"])
      expect(withLink(url)).toBe(false);
  });
});
