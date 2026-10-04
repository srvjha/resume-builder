import { describe, expect, it } from "vitest";
import { templates } from "../src/templates/index.js";
import { sampleResume } from "../src/templates/sample.js";

const withSpace = (points: number) => {
  const content = structuredClone(sampleResume);
  for (const section of content.sections)
    if ("entries" in section) for (const entry of section.entries) entry.spaceAfter = points;
  return content;
};

const withSectionSpace = (points: number) => {
  const content = structuredClone(sampleResume);
  for (const section of content.sections) section.spaceAfter = points;
  return content;
};

describe("space after a section", () => {
  it("adds it once per section in every template, never twice", () => {
    for (const template of templates) {
      const spaces = template.render(withSectionSpace(11)).match(/\\vspace\{11pt\}/g) ?? [];
      expect(spaces.length, template.id).toBeGreaterThan(0);
      expect(spaces.length, template.id).toBeLessThanOrEqual(sampleResume.sections.length);
    }
  });

  it("leaves resumes without it exactly as before", () => {
    for (const template of templates) {
      expect(template.render(sampleResume), template.id).toBe(template.render(withSectionSpace(0)));
    }
  });
});

describe("space after an entry", () => {
  it("adds the chosen space after entries in every template", () => {
    for (const template of templates) {
      expect(template.render(withSpace(8)), template.id).toMatch(/\\vspace\{8pt\}|\\addlinespace\[8pt\]/);
    }
  });

  it("leaves resumes without it exactly as before", () => {
    for (const template of templates) {
      expect(template.render(sampleResume), template.id).toBe(template.render(withSpace(0)));
    }
  });
});
