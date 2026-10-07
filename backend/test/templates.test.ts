import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTectonic } from "../src/lib/latex/tectonic.js";
import { resumeContentSchema } from "../src/schemas/resume-content.js";
import { templates } from "../src/templates/index.js";
import { sampleResume } from "../src/templates/sample.js";
import { leadsWithEducation } from "../src/templates/shared-business.js";

const hasTectonic = (() => {
  try {
    execFileSync("tectonic", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

const compile = createTectonic({ bin: "tectonic", onlyCached: false, timeoutMs: 120_000, concurrency: 2 });
const bare = resumeContentSchema.parse({ basics: { name: "Only Name" }, sections: [] });
const nameless = resumeContentSchema.parse({ basics: { name: "", headline: "Data Analyst" }, sections: [] });

describe.skipIf(!hasTectonic)("templates compile", () => {
  for (const template of templates) {
    it(`${template.id} with full content`, async () => {
      const result = await compile(template.render(sampleResume));
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });

    it(`${template.id} with a summary section`, async () => {
      const text = "Analyst with **5 years** in M&A and 20% growth, focused on #fintech.";
      const withSummary = {
        ...sampleResume,
        sections: [
          { id: "summary", title: "Summary", hidden: false, type: "summary" as const, text },
          ...sampleResume.sections,
        ],
      };
      const tex = template.render(withSummary);
      expect(tex).toContain("5 years");
      const result = await compile(tex);
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });

    it(`${template.id} with no name yet`, async () => {
      const result = await compile(template.render(nameless));
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });

    it(`${template.id} with only a name`, async () => {
      const result = await compile(template.render(bare));
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });

    it(`${template.id} with a skills section added but not filled in`, async () => {
      const empty = resumeContentSchema.parse({
        basics: { name: "Only Name" },
        sections: [{ id: "s", title: "Technical Skills", type: "skills", groups: [{ id: "g", name: "Languages", items: [] }] }],
      });
      const result = await compile(template.render(empty));
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });

    it(`${template.id} with every spacing preset and font size`, async () => {
      for (const layout of [
        { spacing: "compact", fontSize: 10 },
        { spacing: "relaxed", fontSize: 12 },
      ] as const) {
        const result = await compile(template.render(sampleResume, layout));
        expect(result.ok, JSON.stringify(result)).toBe(true);
      }
    });
  }
});

describe("templates hide content", () => {
  it("omits hidden bullets, entries and sections", () => {
    const content = structuredClone(sampleResume);
    const experience = content.sections.find((s) => s.type === "experience");
    if (experience?.type !== "experience") throw new Error("fixture changed");
    experience.entries[0]!.bullets[0]!.hidden = true;
    const skills = content.sections.find((s) => s.type === "skills")!;
    skills.hidden = true;

    for (const template of templates) {
      const texSource = template.render(content);
      expect(texSource).not.toContain("payouts API");
      expect(texSource).not.toContain("Technical Skills");
    }
  });
});

// sha256 of each template's sample render before layouts existed. The default layout must not change a byte;
// if the sample or a template changes on purpose, update the hash.
const beforeLayouts: Record<string, string> = {
  developer: "f03a52667fb6e2c75ee3ab5a0dad2b326fde2052dbb5da0144affc80771d1ad6",
  jake: "f552f89f5eeb30b5385f0c1519fea1db676c5e969e357cbe7540986926925858",
  modern: "aab366245d5e9d007fc4405475e7d5cc7c540efa33d0d4bda162550d4d87aa0e",
  sb2nov: "d95e61527832da2ed99cb44aca343b78eab8fd1ec01c277d2e8cc773e47cb6fe",
  "ml-research": "4ce13687662d02f0d852af9283b5605d07980d8da3c9f01a703dd9a09a133528",
  "data-analyst": "45659916cd9fb6c85b3e3dcdff7a9c009d33d109613b76e036b2e63ece26ab1d",
  "product-manager": "b94658f9e8b82b89c2ddf8c73138e95a6731b255816acb12bbb43dc17cb845d8",
  designer: "7ea58da346a04612a631a0bc97d864c06db701a2aa1126932652fbf527d1fa83",
  campus: "41c8ea2c0d511a8d041db807d04337be35336db19a035adc1aac125c0ed71f35",
  banking: "b43b1b41ab906aadf023aaa06a2142247910d915ccb9e8d9d209353692cc5c69",
  finance: "56d9eabc725f8cc9fc4dca38d6fda5547c95b626b6198ad712044ea8a06a7cb5",
  consulting: "124089b93f04a6406a4251ad2bc6fcfbe60b6422a07dd61ec158e88e47221197",
  marketing: "7eda8b4d547bce319fa766861dbea22f9d4f2710fc2dc53bd1d3e63db8171a72",
  executive: "6c1534345e19af92759176e919e65461ca6307ee47447b97dbf075e0c266a25b",
};

describe("default layout", () => {
  const sha = (texSource: string) => createHash("sha256").update(texSource).digest("hex");
  for (const template of templates) {
    it(`${template.id} renders exactly as before`, () => {
      expect(sha(template.render(sampleResume))).toBe(beforeLayouts[template.id]);
      expect(sha(template.render(sampleResume, { spacing: "normal" }))).toBe(beforeLayouts[template.id]);
    });
  }

  it("changes the font size and spacing when asked", () => {
    const texSource = templates[0]!.render(sampleResume, { spacing: "compact", fontSize: 12 });
    expect(texSource).toMatch(/^\\documentclass\[letterpaper,12pt\]/);
    expect(texSource).toContain("\\linespread{0.95}");
  });
});

describe("leadsWithEducation", () => {
  it("puts education first early in a career", () => {
    expect(leadsWithEducation(sampleResume.sections)).toBe(true);
    expect(leadsWithEducation([])).toBe(true);
  });

  it("puts experience first after two roles since graduating", () => {
    const sections = sampleResume.sections.map((section) => {
      if (section.type === "education")
        return { ...section, entries: section.entries.map((e) => ({ ...e, start: "2017-07", end: "2021-05" })) };
      if (section.type === "experience") {
        const [first] = section.entries;
        return {
          ...section,
          entries: [
            { ...first!, start: "2021-07" },
            { ...first!, id: `${first!.id}-2`, start: "2023-01" },
          ],
        };
      }
      return section;
    });
    expect(leadsWithEducation(sections)).toBe(false);
  });
});
