import { describe, expect, it } from "vitest";
import { toJsonResume } from "../src/modules/pdfs/json-resume.js";
import { sampleResume } from "../src/templates/sample.js";

describe("toJsonResume", () => {
  it("keeps every section of a type, not just the last", () => {
    const experience = sampleResume.sections.find((s) => s.type === "experience")!;
    const internships = { ...experience, id: "internships", title: "Internships" };
    const content = { ...sampleResume, sections: [...sampleResume.sections, internships] };
    const work = toJsonResume(content).work as unknown[];
    expect(work).toHaveLength(2 * (experience.type === "experience" ? experience.entries.length : 0));
  });
});
