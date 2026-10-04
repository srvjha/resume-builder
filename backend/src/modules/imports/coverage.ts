import { shortId } from "../../lib/ids.js";
import type { ResumeContent } from "../../schemas/resume-content.js";
import type { ParsedResume, SectionKind } from "../ats/parser/types.js";

// After the AI reads a PDF, a rule-based read of the same PDF checks that no line was dropped.
// Missed lines go back as hidden bullets under the entry they sat under, so nothing is lost and
// nothing extra prints if a line was only reworded.

const dateWords =
  /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|present|current|now)\b|\b(19|20)\d{2}\b/g;

// Dates are dropped first: the AI rewrites "May 2025" as "2025-05", which isn't a missed line.
function words(text: string) {
  return text
    .toLowerCase()
    .replace(dateWords, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const pairs = (text: string) => {
  const w = words(text);
  return w.slice(1).map((word, i) => `${w[i]} ${word}`);
};

// Every string in the content, plus each entry's fields joined (bullets aside), because a PDF prints
// "Languages: Go, TypeScript" or "LedgerLite | Go, Kafka | GitHub" on one line from separate fields.
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") {
    const fields = Object.entries(value).filter(([key]) => key !== "id");
    const own = fields.filter(([key]) => key !== "bullets").flatMap(([, v]) => strings(v));
    return [...fields.flatMap(([, v]) => strings(v)), own.join(" ")];
  }
  return [];
}

// Column headings some templates print, like "Degree Institution Score Year", are not content.
const labelWords = new Set([
  "degree",
  "institution",
  "score",
  "year",
  "years",
  "cgpa",
  "gpa",
  "grade",
  "percentage",
  "board",
  "duration",
  "company",
  "role",
  "position",
  "location",
  "date",
  "dates",
]);

// ponytail: word pairs are a heuristic. Two-column PDFs mix columns on one line, so misses there are
// often not caught. A line the AI reworded heavily can read as missed (it is then
// restored hidden, so harmless), and a dropped line made only of words found elsewhere can read as kept.
// The upgrade is a proper alignment of source lines to output fields.
function share(line: string, known: Set<string>) {
  if (words(line).every((word) => labelWords.has(word))) return null;
  const p = pairs(line);
  return p.length < 2 ? null : p.filter((pair) => known.has(pair)).length / p.length;
}

const sectionTypes: Record<SectionKind, ResumeContent["sections"][number]["type"]> = {
  experience: "experience",
  education: "education",
  projects: "projects",
  skills: "skills",
  summary: "summary",
  other: "list",
};

const MAX_BULLETS = 20;

export function restoreMissedLines(content: ResumeContent, parsed: ParsedResume) {
  const known = new Set(strings(content).flatMap(pairs));
  const missed: { text: string; placed: boolean }[] = [];
  const next = structuredClone(content);

  // Contact details the rules can read for certain fill fields the AI left empty.
  if (!next.basics.email && parsed.email) next.basics.email = parsed.email;
  if (!next.basics.phone && parsed.phone) next.basics.phone = parsed.phone;

  for (const section of parsed.sections) {
    const target = next.sections.find((s) => s.type === sectionTypes[section.kind ?? "other"]);
    const entries = target && "entries" in target ? target.entries : [];
    let current = entries[0];
    for (const line of section.lines) {
      const covered = share(line, known);
      if (covered === null) continue;
      if (covered >= 0.5) {
        // Track which entry the PDF is in, so a missed bullet lands under the right job or project.
        const entryPairs = entries.map((entry) => new Set(strings(entry).flatMap(pairs)));
        const index = entryPairs.findIndex((set) => (share(line, set) ?? 0) >= 0.5);
        if (index !== -1) current = entries[index];
        continue;
      }
      const text = line.replace(/^[•●▪◦\-–*]\s*/, "").trim();
      const placed = !!current && current.bullets.length < MAX_BULLETS;
      if (placed) current!.bullets.push({ id: shortId(), text: text.slice(0, 600), hidden: true });
      missed.push({ text, placed });
    }
  }
  return { content: next, missed };
}
