import type { ResumeSection } from "../schemas/resume-content.js";
import { renderSections } from "./classic-body.js";
import { tex, texRich, texUrl, withGap, displayUrl } from "./latex.js";

// Helpers for the field-specific templates (research, analyst, product, designer, campus).

export function bullets(items: { text: string }[]) {
  if (items.length === 0) return "";
  return [
    "\\resumeItemListStart",
    ...items.map((item) => `  \\resumeItem{${texRich(item.text)}}`),
    "\\resumeItemListEnd",
  ].join("\n");
}

export const isPublications = (section: ResumeSection): section is Extract<ResumeSection, { type: "list" }> =>
  section.type === "list" && /publication|paper|preprint/i.test(section.title);

// fontspec setup for a bundle font whose files are named <family>-Regular, -Bold, -Italic, -BoldItalic.
export const bundleFont = (family: string, ext = ".otf") =>
  String.raw`\setmainfont{${family}}[Extension=${ext}, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic]`;

// Skill groups as flush "Group: items" lines, aligned with entries that start at the margin.
function skillsBlock(s: Extract<ResumeSection, { type: "skills" }>) {
  const lines = s.groups
    .filter((g) => g.items.length > 0)
    .map((g) => `\\textbf{${tex(g.name)}}: ${tex(g.items.join(", "))}`);
  if (lines.length === 0) return "";
  return `\\section{${tex(s.title)}}\n${lines.join(" \\\\\n")}\\par`;
}

function linksBlock(s: Extract<ResumeSection, { type: "links" }>) {
  if (s.links.length === 0) return "";
  const links = s.links
    .map((l) => `\\mbox{${tex(l.label)}: \\href{${texUrl(l.url)}}{\\underline{${tex(displayUrl(l.url))}}}}`)
    .join(", ");
  return `\\section{${tex(s.title)}}\n${links}\\par`;
}

function summaryBlock(s: Extract<ResumeSection, { type: "summary" }>) {
  return s.text ? `\\section{${tex(s.title)}}\n${texRich(s.text)}\\par` : "";
}

// Renders each section with the template's own renderer where it has one, else flush skills, links and
// summary blocks, else the shared classic body.
export const renderBody = (
  sections: ResumeSection[],
  custom: (s: ResumeSection) => string | undefined = () => undefined,
) =>
  sections
    .map((s) => {
      const own =
        custom(s) ??
        (s.type === "skills"
          ? skillsBlock(s)
          : s.type === "links"
            ? linksBlock(s)
            : s.type === "summary"
              ? summaryBlock(s)
              : undefined);
      // renderSections adds the section's space itself.
      return own === undefined ? renderSections([s]) : withGap(own, s);
    })
    .filter(Boolean)
    .join("\n\n");
