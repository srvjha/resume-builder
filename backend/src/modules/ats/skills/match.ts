import data from "./skills.json" with { type: "json" };
import { nameKey, tokenize, type Token } from "./tokens.js";

type Entry = {
  name: string;
  aliases: string[];
  kind: "hard" | "soft";
  category: string;
  source: string[];
  ambiguous?: boolean;
  cased?: string[];
};
type Name = { entry: Entry; name: string; ambiguous: boolean; cased: boolean };
type Occurrence = { name: Name; first: number; last: number; matchedAs: string };

export type SkillHit = { skill: string; kind: "hard" | "soft"; category: string; matchedAs: string };

const NAMES = new Map<string, Name>();
let longest = 1;
for (const entry of data as Entry[]) {
  for (const name of [entry.name, ...entry.aliases]) {
    const key = nameKey(name);
    if (NAMES.has(key)) continue;
    const ambiguous = name === entry.name && Boolean(entry.ambiguous);
    NAMES.set(key, { entry, name, ambiguous, cased: ambiguous || Boolean(entry.cased?.includes(name)) });
    longest = Math.max(longest, key.split(" ").length);
  }
}

// Words around an ambiguous name that make it a skill: "Go programming", "R scripts", "proficient in Excel".
const AFTER = new Set(
  "programming language lang developer developers programmer programmers engineer engineers code coding scripting scripts skills spreadsheet spreadsheets vba macros formulas pivot vlookup modeling modelling models model dashboards sdk framework services microservices backend runtime".split(
    " ",
  ),
);
const BEFORE = new Set(["microsoft", "ms", "advanced", "apple", "using"]);
const BEFORE_PREPOSITION = new Set(["in", "with", "of"]);
const BEFORE_LEAD = new Set(
  "proficient proficiency experience experienced expertise skilled knowledge fluent fluency working programming coding developed built written wrote writing".split(
    " ",
  ),
);
const LIST_GAP = /^[\s,|/;&()\u00b7\u2022+]*[,|/;&()\u00b7\u2022+][\s,|/;&()\u00b7\u2022+]*$/;

function scan(text: string, inSkillsSection: boolean): Occurrence[] {
  const tokens = tokenize(text);
  const found: Occurrence[] = [];
  for (let i = 0; i < tokens.length;) {
    let hit: Occurrence | null = null;
    for (let n = Math.min(longest, tokens.length - i); n > 0 && !hit; n--) {
      const name = NAMES.get(
        tokens
          .slice(i, i + n)
          .map((t) => t.key)
          .join(" "),
      );
      if (!name) continue;
      const matchedAs = text.slice(tokens[i]!.start, tokens[i + n - 1]!.end);
      const caseOk =
        !name.cased || matchedAs === name.name || (!name.ambiguous && matchedAs === name.name.toUpperCase());
      if (caseOk) hit = { name, first: i, last: i + n - 1, matchedAs };
    }
    if (hit) found.push(hit);
    i = hit ? hit.last + 1 : i + 1;
  }

  const accepted = found.map((o) => !o.name.ambiguous || inSkillsSection || hasCue(tokens, o));
  // A skill list ("C, C++, Go, R") vouches for its ambiguous members, one neighbour at a time.
  const listed = (k: number, j: number) => {
    const [left, right] = k < j ? [found[k]!, found[j]] : [found[j], found[k]!];
    if (!left || !right || !accepted[j]) return false;
    const between = tokens.slice(left.last + 1, right.first);
    if (between.length > 1 || (between[0] && !["and", "or"].includes(between[0].key))) return false;
    return between.length === 1 || LIST_GAP.test(text.slice(tokens[left.last]!.end, tokens[right.first]!.start));
  };
  // One sweep each way reaches every list member; a fixed-point loop was O(n^2) on long lists.
  for (let k = 1; k < found.length; k++) if (!accepted[k] && listed(k, k - 1)) accepted[k] = true;
  for (let k = found.length - 2; k >= 0; k--) if (!accepted[k] && listed(k, k + 1)) accepted[k] = true;
  return found.filter((_, k) => accepted[k]);
}

function hasCue(tokens: Token[], o: Occurrence) {
  const before = tokens[o.first - 1]?.key ?? "";
  const lead = tokens[o.first - 2]?.key ?? "";
  return (
    AFTER.has(tokens[o.last + 1]?.key ?? "") ||
    BEFORE.has(before) ||
    (BEFORE_PREPOSITION.has(before) && BEFORE_LEAD.has(lead))
  );
}

const toHit = (o: Occurrence): SkillHit => ({
  skill: o.name.entry.name,
  kind: o.name.entry.kind,
  category: o.name.entry.category,
  matchedAs: o.matchedAs,
});

function unique(occurrences: Occurrence[]) {
  const seen = new Map<string, SkillHit>();
  for (const o of occurrences) if (!seen.has(o.name.entry.name)) seen.set(o.name.entry.name, toHit(o));
  return [...seen.values()];
}

// Ambiguous names (Go, C, R, Excel, Spring) count only in their exact case and with context: in the skills
// section, in a separated list next to another skill, or beside a word like "programming" or "Microsoft".
export function findSkills(text: string, context?: { skillsSection?: string }): SkillHit[] {
  return unique([...scan(text, false), ...(context?.skillsSection ? scan(context.skillsSection, true) : [])]);
}

// Every way a skill is written: its name and aliases, for "Machine Learning (ML)" style advice.
export function skillForms(skill: string) {
  const entry = (data as Entry[]).find((e) => e.name === skill);
  return entry ? [entry.name, ...entry.aliases] : [skill];
}

// How often each skill appears, counting every mention rather than once per skill.
export function skillCounts(text: string) {
  const counts = new Map<string, number>();
  for (const o of scan(text, false)) counts.set(o.name.entry.name, (counts.get(o.name.entry.name) ?? 0) + 1);
  return counts;
}

const NICE =
  /\b(?:nice|good)[ -]to[ -]have\b|\bpreferred\b|\bpreferably\b|\bbonus\b|\ba plus\b|\bplus point\b|\badvantage(?:ous)?\b|\bdesirable\b|\bdesired\b|\boptional\b|\bnot (?:required|mandatory)\b/i;
const MUST =
  /\brequire[ds]?\b|\brequirements?\b|\bmust\b|\bmandatory\b|\bminimum\b|\bessential\b|\byou(?:'ll| will)? have\b|\bwhat you(?:'ll)? need\b|\bqualifications?\b|\bstrong (?:knowledge|experience|proficiency|understanding|command)\b|\bproficien(?:t|cy)\b|\bexpertise\b|\bhands[ -]on\b|\b\d+\+?\s*(?:years?|yrs)\b/i;
const BULLET = /^\s*(?:[-*\u2022\u00b7\u25aa\u25cf\u2013]|\d+[.)])\s*/u;

type Mode = "must" | "nice" | "neutral";
const modeOf = (text: string, fallback: Mode): Mode => (NICE.test(text) ? "nice" : MUST.test(text) ? "must" : fallback);

// Must-haves come from "Requirements"-style sections and from clauses saying required, must, minimum or
// "3+ years"; "nice to have", "preferred", "bonus" and "a plus" win over them.
export function jobRequirements(jobText: string): { hard: SkillHit[]; soft: SkillHit[]; mustHave: Set<string> } {
  const all: Occurrence[] = [];
  const mustHave = new Set<string>();
  let section: Mode = "neutral";
  for (const rawLine of jobText.split(/\r?\n/)) {
    const line = rawLine.replace(/^#+\s*|\*\*/g, "").trim();
    if (!line) continue;
    const found = scan(line, false);
    const heading =
      !BULLET.test(rawLine) &&
      found.length === 0 &&
      line.split(/\s+/).length <= 6 &&
      !/[.,]$/.test(line) &&
      (line.endsWith(":") || /^\p{Lu}/u.test(line));
    if (heading) {
      section = modeOf(line, "neutral");
      continue;
    }
    for (const clause of line.split(/(?<=[.;!?])\s+/)) {
      const occurrences = scan(clause, false);
      if (modeOf(clause, section) === "must") for (const o of occurrences) mustHave.add(o.name.entry.name);
      all.push(...occurrences);
    }
  }
  const hits = unique(all);
  return { hard: hits.filter((h) => h.kind === "hard"), soft: hits.filter((h) => h.kind === "soft"), mustHave };
}

// Score weights, after Jobscan's order (hard skills, then soft): a must-have hard skill counts 3, any other
// hard skill 2, a soft skill 1. The score is the matched share of the job's total weight, 0 when it lists none.
const WEIGHT = { mustHard: 3, hard: 2, soft: 1 };

export function matchJob(
  resumeText: string,
  jobText: string,
  context?: { skillsSection?: string },
): {
  hard: { matched: string[]; missing: string[] };
  soft: { matched: string[]; missing: string[] };
  mustHave: string[];
  mustHaveMissing: string[];
  score: number;
} {
  const job = jobRequirements(jobText);
  const have = new Set(findSkills(resumeText, context).map((h) => h.skill));
  const split = (hits: SkillHit[]) => ({
    matched: hits.filter((h) => have.has(h.skill)).map((h) => h.skill),
    missing: hits.filter((h) => !have.has(h.skill)).map((h) => h.skill),
  });
  const weight = (h: SkillHit) =>
    h.kind === "soft" ? WEIGHT.soft : job.mustHave.has(h.skill) ? WEIGHT.mustHard : WEIGHT.hard;
  const skills = [...job.hard, ...job.soft];
  const total = skills.reduce((sum, h) => sum + weight(h), 0);
  const earned = skills.filter((h) => have.has(h.skill)).reduce((sum, h) => sum + weight(h), 0);
  return {
    hard: split(job.hard),
    soft: split(job.soft),
    mustHave: skills.filter((h) => job.mustHave.has(h.skill)).map((h) => h.skill),
    mustHaveMissing: skills.filter((h) => job.mustHave.has(h.skill) && !have.has(h.skill)).map((h) => h.skill),
    score: total === 0 ? 0 : earned / total,
  };
}

const SENIORITY = new Set(
  "senior sr jr junior lead staff principal associate trainee entry level mid i ii iii iv v 1 2 3".split(" "),
);
// Applied in order on normalized titles; developer and engineer are treated as the same role.
const TITLE_SYNONYMS: [RegExp, string][] = [
  [
    /\b(?:sde|swe|software development engineer|software developer|software engineering|programmer)\b/g,
    "software engineer",
  ],
  [/\bback end\b/g, "backend"],
  [/\bfront end\b/g, "frontend"],
  [/\bfull stack\b|\bfullstack\b/g, "fullstack"],
  [/\b(?:developer|dev)\b/g, "engineer"],
  [/\b(?:pm|apm)\b/g, "product manager"],
  [/\bmachine learning\b/g, "ml"],
  [/\bsre\b/g, "site reliability engineer"],
  [/\b(?:sdet|test engineer|qa engineer|quality assurance engineer)\b/g, "qa engineer"],
  [/\bib\b/g, "investment banking"],
  [/\bba\b/g, "business analyst"],
  [/\bui ux\b|\bux ui\b/g, "ux"],
];
const ROLE_NOUNS =
  /\b(?:engineer|developer|analyst|manager|designer|scientist|consultant|associate|intern|architect|specialist|administrator|executive|officer|accountant|tester|sde|swe|pm|apm|lead|head|director|strategist|researcher|programmer)s?\b/i;

function normalizeTitle(title: string) {
  let text = ` ${title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")} `;
  for (const [pattern, replacement] of TITLE_SYNONYMS) text = text.replace(pattern, replacement);
  return text
    .split(" ")
    .filter((w) => w && !SENIORITY.has(w))
    .join(" ");
}

function jobTitleOf(jobText: string) {
  const phrase =
    /(?:\b(?:hiring|looking for|seeking)\s+(?:an?\s+)?|\b(?:role|position|job title|title|designation)\s*[:-]\s*)([^\n.,!;:(]+)/i.exec(
      jobText,
    )?.[1];
  const fromPhrase = phrase?.split(/\s+(?:to|who|with|for|in|at|on|that|from)\s+/i)[0]?.trim();
  const heading = jobText
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#+\s*|\*\*/g, "")
        .replace(/^(?:role|position|job title|title|designation)\s*[:-]\s*/i, "")
        .trim(),
    )
    .find(Boolean)
    ?.split(/\s+[-|@\u2013]\s+|,/)[0]
    ?.trim();
  if (heading && heading.split(/\s+/).length <= 6 && !/[.!?]$/.test(heading) && ROLE_NOUNS.test(heading))
    return heading;
  return fromPhrase && ROLE_NOUNS.test(fromPhrase) ? fromPhrase : null;
}

// Exact: the resume title contains the job's title once seniority and synonyms are normalized. Close: same
// role noun (the last word) and a shared qualifier, or one side only says "software". Data Analyst and Business
// Analyst share only the noun, so they don't match.
export function titleMatch(
  resumeTitles: string[],
  jobText: string,
): { jobTitle: string | null; best: string | null; level: "exact" | "close" | "none" } {
  const jobTitle = jobTitleOf(jobText);
  const job = jobTitle ? normalizeTitle(jobTitle) : "";
  if (!job) return { jobTitle, best: null, level: "none" };
  const jobWords = job.split(" ");
  // An internship is not an exact match for a full-time role with the same name.
  const junior = /\b(intern|internship|trainee|apprentice)\b/;
  const jobIsJunior = junior.test(job);
  const candidates = resumeTitles.flatMap((t) => t.split(/\s*[|,/\u00b7\u2022]\s*|\s+[-\u2013]\s+/)).filter(Boolean);
  let best: { title: string; level: "exact" | "close" } | null = null;
  for (const title of candidates) {
    const own = normalizeTitle(title);
    if (` ${own} `.includes(` ${job} `)) {
      if (jobIsJunior || !junior.test(own)) return { jobTitle, best: title, level: "exact" };
      best ??= { title, level: "close" };
      continue;
    }
    const words = own.split(" ");
    if (!best && words.at(-1) === jobWords.at(-1)) {
      const a = jobWords.slice(0, -1).filter((w) => w !== "software");
      const b = words.slice(0, -1).filter((w) => w !== "software");
      if (a.length === 0 || b.length === 0 || a.some((w) => b.includes(w))) best = { title, level: "close" };
    }
  }
  return { jobTitle, best: best?.title ?? null, level: best?.level ?? "none" };
}
