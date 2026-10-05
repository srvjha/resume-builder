import type { ResumeContent } from "../../schemas/resume-content.js";
import { SECTION_HEADINGS } from "./words.js";

// Advisory hints about a job's hard requirements. They never change the ATS score.
export type Knockout = {
  id: string;
  label: string;
  requirement: string;
  required: boolean;
  status: "met" | "not-met" | "unclear" | "not-on-resume";
  evidence: string | null;
  advice: string;
};

type Resume = { text: string; content?: ResumeContent };
type Finding = Pick<Knockout, "status" | "evidence" | "advice"> & { label?: string };
type Rule = {
  id: string;
  label: string;
  test: RegExp;
  skip?: RegExp;
  check: (s: string, r: Resume, job: string) => Finding[];
};

const MAX_KNOCKOUTS = 8;
const DASH = "[-\\u2013\\u2014]";
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
};
const NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})`;
const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const MONTH = `(?:(${MONTHS.join("|")})[a-z]*\\.?\\s+)?`;
const RANGE = new RegExp(
  `${MONTH}((?:19|20)\\d{2})\\s*(?:${DASH}|to)\\s*(?:(present|current|now|till date|today)|${MONTH}((?:19|20)\\d{2}))`,
  "gi",
);

const PREFERRED = /\b(prefer\w*|nice to have|good to have|plus|bonus|desirable|advantage\w*|ideally)\b/i;
const REQ_HEADING =
  /requirement|qualification|what you('ll| will)? (need|bring)|who you are|you (have|bring)|must have|eligibility|looking for|skills|about you|criteria/i;
const BLURB_HEADING =
  /about (us|the company|the team|company)|who we are|our (story|mission|culture|values)|benefits|perks|what we offer|why (join|work)|compensation|life at/i;
// "We have 15 years of experience serving clients" describes the company, not the candidate.
const COMPANY_SUBJECT =
  /\b(we|our (company|team|firm|founders))\b[^.]*\b(have|has|bring|been|with)\b(?![^.]*\b(you|candidate|looking|seeking|hiring)\b)/i;

const CITIES: { name: string; re: RegExp; country: string }[] = [
  { name: "Bengaluru", re: /\b(bengaluru|bangalore)\b/i, country: "India" },
  { name: "Mumbai", re: /\b(mumbai|bombay)\b/i, country: "India" },
  { name: "Delhi NCR", re: /\b(new delhi|delhi|ncr|gurgaon|gurugram|noida)\b/i, country: "India" },
  { name: "Hyderabad", re: /\b(hyderabad|secunderabad)\b/i, country: "India" },
  { name: "Chennai", re: /\b(chennai|madras)\b/i, country: "India" },
  { name: "Pune", re: /\bpune\b/i, country: "India" },
  { name: "Kolkata", re: /\b(kolkata|calcutta)\b/i, country: "India" },
  { name: "Ahmedabad", re: /\bahmedabad\b/i, country: "India" },
  { name: "Jaipur", re: /\bjaipur\b/i, country: "India" },
  { name: "Kochi", re: /\b(kochi|cochin)\b/i, country: "India" },
  { name: "Chandigarh", re: /\bchandigarh\b/i, country: "India" },
  { name: "London", re: /\blondon\b/i, country: "United Kingdom" },
  { name: "New York", re: /\bnew york\b/i, country: "United States" },
  { name: "San Francisco", re: /\b(san francisco|bay area)\b/i, country: "United States" },
  { name: "Seattle", re: /\bseattle\b/i, country: "United States" },
  { name: "Singapore", re: /\bsingapore\b/i, country: "Singapore" },
  { name: "Dubai", re: /\bdubai\b/i, country: "United Arab Emirates" },
];
const COUNTRIES: { name: string; re: RegExp }[] = [
  { name: "India", re: /\bindia\b/i },
  { name: "United States", re: /\b(US|USA)\b|U\.S\.|United States/ },
  { name: "United Kingdom", re: /\bUK\b|U\.K\.|United Kingdom/ },
  { name: "Canada", re: /\bcanada\b/i },
  { name: "Singapore", re: /\bsingapore\b/i },
];

const DEGREES: { level: string; rank: number; re: RegExp }[] = [
  {
    level: "bachelor's",
    rank: 1,
    re: /\b(b\.? ?tech|bachelor'?s?|b\.? ?sc|bca|b\.? ?com|b\.?s\.? in|b\.?a\.? in|undergraduate degree)\b|\bB\.?E\b/i,
  },
  { level: "master's", rank: 2, re: /\b(m\.? ?tech|master'?s? (degree|of|in)|masters\b|m\.? ?sc|mca|m\.?s\.? in)\b/i },
  { level: "MBA", rank: 2, re: /\b(mba|pgdm|pgp)\b/i },
  { level: "PhD", rank: 3, re: /\b(ph\.? ?d|doctorate)\b/i },
  { level: "degree", rank: 0, re: /\bdegree (in|from)\b|\b(engineering|university|college) degree\b|\bgraduate in\b/i },
];
// "BE" only counts in capitals, so "must be" is not a degree.
const isDegree = (d: (typeof DEGREES)[number], text: string) =>
  d.level === "bachelor's" ? d.re.test(text.replace(/\bbe\b/g, "")) : d.re.test(text);
const CS_FIELD = /computer|\bCSE?\b|\bIT\b|information tech|software/i;

const CERTS: { label: string; job: RegExp; resume: RegExp }[] = [
  { label: "AWS certification", job: /\bAWS[- ]certifi|\bAWS Certified/i, resume: /\bAWS (certified|certification)/i },
  {
    label: "Azure certification",
    job: /\bAzure[\w ]{0,30}certifi|\bAZ-\d{3}\b/i,
    resume: /Azure[\w ]*certifi|AZ-\d{3}/i,
  },
  {
    label: "Google Cloud certification",
    job: /\b(GCP|Google Cloud)[\w ]{0,30}certifi/i,
    resume: /(GCP|Google Cloud)[\w ]*certifi/i,
  },
  {
    label: "Chartered Accountant (CA)",
    job: /chartered accountant|(?<!, )\bCA\b/,
    resume: /chartered accountant|\bCA\b/,
  },
  ...["CFA", "CPA", "PMP", "FRM", "ACCA", "CISSP", "CKA", "CCNA", "CISA"].map((a) => ({
    label: a,
    job: new RegExp(`\\b${a}\\b`),
    resume: new RegExp(`\\b${a}\\b`),
  })),
];
const LANGUAGES =
  "English Hindi Tamil Telugu Kannada Marathi Bengali Gujarati Malayalam Japanese German French Spanish Mandarin Arabic Portuguese Korean".split(
    " ",
  );

const INTERN = /\bintern(ship)?s?\b/i;

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s);
const toNumber = (s: string) => NUMBER_WORDS[s.toLowerCase()] ?? Number(s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const lineWith = (text: string, re: RegExp) => {
  const line = text.split("\n").find((l) => re.test(l));
  return line ? clip(line.trim(), 100) : null;
};
const resumeLocation = (r: Resume) => r.content?.basics.location || r.text.split("\n").slice(0, 6).join("\n");

// Lines of a resume text section, found with the same headings the ATS score uses.
function resumeSection(text: string, id: string) {
  const out: string[] = [];
  let inside = false;
  for (const line of text.split("\n")) {
    const key = line
      .toLowerCase()
      .replace(/[^a-z& ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const heading = line.length <= 40 ? SECTION_HEADINGS.find((h) => h.pattern.test(key)) : undefined;
    if (heading) inside = heading.id === id;
    else if (inside) out.push(line);
  }
  return out;
}

// Months since year 0. Ends are exclusive: "2023-06" ends after June, a bare "2023" starts and ends in January.
function monthIndex(year: string, month: string | undefined, end: boolean) {
  return Number(year) * 12 + (month ? Number(month) - (end ? 0 : 1) : 0);
}
const now = () => new Date().getFullYear() * 12 + new Date().getMonth() + 1;

// Total months covered by the ranges, counting overlapping roles once.
export function mergedMonths(ranges: [number, number][]) {
  let total = 0;
  let reach = -Infinity;
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (end <= reach) continue;
    total += end - Math.max(start, reach);
    reach = end;
  }
  return total;
}

// Internships are left out: a job asking for N years means full-time work.
export function resumeExperience(r: Resume) {
  const ranges: [number, number][] = [];
  let undated = 0;
  let roles = 0;
  if (r.content) {
    for (const section of r.content.sections) {
      if (section.type !== "experience" || section.hidden) continue;
      for (const e of section.entries) {
        if (e.hidden || INTERN.test(`${e.role} ${e.organization}`)) continue;
        roles++;
        if (!e.start) {
          undated++;
          continue;
        }
        const [sy = "", sm] = e.start.split("-");
        const [ey, em] = (e.end ?? "present").split("-");
        ranges.push([monthIndex(sy, sm, false), ey === "present" || !ey ? now() : monthIndex(ey, em, true)]);
      }
    }
  } else {
    const lines = resumeSection(r.text, "experience");
    if (lines.length === 0) return null;
    for (const line of lines.filter((l) => !INTERN.test(l))) {
      for (const m of line.matchAll(RANGE)) {
        roles++;
        const month = (name: string | undefined) =>
          name ? String(MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1) : undefined;
        ranges.push([
          monthIndex(m[2] ?? "", month(m[1]), false),
          m[3] ? now() : monthIndex(m[5] ?? "", month(m[4]), true),
        ]);
      }
    }
  }
  return {
    years: Math.round(mergedMonths(ranges.filter(([s, e]) => e > s)) / 1.2) / 10,
    roles,
    undated,
    // [first month, month after the last], as month indexes; reversed ranges are kept for the date checks.
    ranges,
  };
}

function checkExperience(s: string, r: Resume): Finding[] {
  const range = new RegExp(`${NUM}\\s*(?:${DASH}|to)\\s*${NUM}\\+?\\s*(?:years?|yrs?)\\b`, "i").exec(s);
  const single = new RegExp(`${NUM}\\s*\\+?\\s*(?:years?|yrs?)\\b`, "i").exec(s);
  const fresher = /\bfreshers?\b/i.test(s);
  if (!range && !single && !fresher) return [];
  const min = range ? toNumber(range[1] ?? "") : single ? toNumber(single[1] ?? "") : 0;
  const max = range ? toNumber(range[2] ?? "") : fresher && !single ? 1 : undefined;
  const asked = max === undefined ? `${min}+ years` : `${min} to ${max} years`;
  const exp = resumeExperience(r);
  const datesAdvice =
    "Add start and end dates (month and year) to every role so an ATS can work out your years of experience.";
  if (!exp || exp.roles === 0) {
    if (max !== undefined && max <= 1)
      return [
        {
          status: "met",
          evidence: "No full-time roles on your resume, which fits a fresher role",
          advice: "Lead with projects and internships, with dates, since they stand in for work experience.",
        },
      ];
    return [
      {
        status: exp ? "not-met" : "unclear",
        evidence: exp ? "No full-time roles on your resume" : null,
        advice: exp
          ? `The job asks for ${asked}; list any full-time, freelance or part-time work with dates.`
          : datesAdvice,
      },
    ];
  }
  const evidence = `About ${exp.years} years from your experience dates, not counting internships`;
  if (exp.years < min && exp.undated > 0)
    return [
      { status: "unclear", evidence: `${evidence}; ${plural(exp.undated, "role")} without dates`, advice: datesAdvice },
    ];
  if (exp.years < min)
    return [
      {
        status: "not-met",
        evidence,
        advice: `The job asks for ${asked}; if internships or freelance work close the gap, list them with dates.`,
      },
    ];
  if (max !== undefined && exp.years > max + 1)
    return [
      {
        status: "unclear",
        evidence,
        advice: `The job asks for ${asked} and you have more; say in your summary why this role fits you now.`,
      },
    ];
  return [
    {
      status: "met",
      evidence,
      advice: "Add your total years of experience to your summary so a recruiter sees it at once.",
    },
  ];
}

function educationText(r: Resume) {
  if (!r.content) return resumeSection(r.text, "education").join("\n") || r.text;
  return r.content.sections
    .flatMap((section) =>
      section.type === "education" && !section.hidden ? section.entries.filter((e) => !e.hidden) : [],
    )
    .map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(", "))
    .join("\n");
}

function checkDegree(s: string, r: Resume): Finding[] {
  const want = DEGREES.filter((d) => isDegree(d, s));
  const edu = educationText(r);
  const have = DEGREES.filter((d) => d.rank > 0 && isDegree(d, edu));
  const specific = want.filter((d) => d.rank > 0);
  const evidence = edu ? clip(edu.split("\n").find((l) => l.trim()) ?? "", 100) : null;
  const asked = specific.map((d) => d.level).join(" or ") || "a degree";
  if (!edu.trim())
    return [
      {
        status: "not-met",
        evidence: null,
        advice: `The job asks for ${asked}; add your education with the degree name.`,
      },
    ];
  if (have.length === 0)
    return [
      {
        status: "unclear",
        evidence,
        advice:
          'Write your degree and field in full, for example "B.Tech in Computer Science", so an ATS can match it.',
      },
    ];
  const levelOk =
    specific.length === 0 ||
    specific.some((w) => have.some((h) => (w.level === "MBA" ? h.level === "MBA" : h.rank >= w.rank)));
  if (!levelOk)
    return [
      {
        status: "not-met",
        evidence,
        advice: `The job asks for ${asked}; if you have an equivalent, name it the way the job does.`,
      },
    ];
  if (CS_FIELD.test(s) && !CS_FIELD.test(edu))
    return /related|equivalent|similar|allied/i.test(s)
      ? [
          {
            status: "unclear",
            evidence,
            advice:
              "The job wants Computer Science or a related field; name your field in full so a recruiter can judge the fit.",
          },
        ]
      : [
          {
            status: "not-met",
            evidence,
            advice:
              "The job asks for a Computer Science degree; show related coursework or certifications if your field differs.",
          },
        ];
  return [
    {
      status: "met",
      evidence,
      advice:
        'Keep the degree written the way the job writes it, for example "B.Tech in Computer Science", so keyword filters match.',
    },
  ];
}

function checkGraduationYear(s: string, r: Resume): Finding[] {
  const want = s.match(/\b20\d{2}\b/g);
  if (!want) return [];
  const ends = r.content
    ? r.content.sections.flatMap((x) => (x.type === "education" ? x.entries.map((e) => e.end?.slice(0, 4)) : []))
    : (resumeSection(r.text, "education")
        .join(" ")
        .match(/\b20\d{2}\b/g) ?? []);
  const found = ends.filter((y): y is string => !!y && /^\d{4}$/.test(y));
  if (found.length === 0)
    return [
      {
        status: "unclear",
        evidence: null,
        advice: "Add your graduation year (or expected year) to your education so a recruiter can check the batch.",
      },
    ];
  const evidence = `Graduation years on your resume: ${[...new Set(found)].join(", ")}`;
  return found.some((y) => want.includes(y))
    ? [{ status: "met", evidence, advice: 'Keep the year next to your degree, for example "B.Tech, 2026 (expected)".' }]
    : [
        {
          status: "not-met",
          evidence,
          advice: `This hiring is for ${want.join(" or ")} graduates; check the eligibility before applying.`,
        },
      ];
}

function checkLocation(s: string, r: Resume): Finding[] {
  const where = resumeLocation(r);
  const cities = CITIES.filter((c) => c.re.test(s));
  const country = /\bremote\b/i.test(s) ? COUNTRIES.find((c) => c.re.test(s)) : undefined;
  const based = /\b(?:based in|located in|office in)\s+([A-Z][a-z]+)/.exec(s)?.[1];
  const targets = country
    ? [
        {
          name: `${country.name} (remote)`,
          re: new RegExp(
            `${country.re.source}|${
              CITIES.filter((c) => c.country === country.name)
                .map((c) => c.re.source)
                .join("|") || "$^"
            }`,
            country.re.flags,
          ),
        },
      ]
    : cities.length > 0 &&
        /\b(on-?site|in[- ]office|office|work from|wfo|hybrid|based|located|location|relocat)/i.test(s)
      ? cities
      : based
        ? [{ name: based, re: new RegExp(`\\b${based}\\b`, "i") }]
        : [];
  if (targets.length === 0) return [];
  const names = targets.map((t) => t.name).join(" or ");
  const label = country ? "Remote, country restricted" : "Job location";
  if (!where.trim())
    return [
      {
        label,
        status: "not-on-resume",
        evidence: null,
        advice: "Add your city and country to the top of your resume; recruiters filter by location.",
      },
    ];
  const evidence = `Your resume says ${clip(where.trim(), 60)}`;
  const hit = targets.find((t) => t.re.test(where));
  if (hit)
    return [
      {
        label,
        status: "met",
        evidence: `Your resume says ${r.content?.basics.location ?? lineWith(where, hit.re)}`,
        advice: "Keep your city in the header so location filters match you.",
      },
    ];
  return [
    {
      label,
      status: r.content?.basics.location ? "not-met" : "unclear",
      evidence: r.content?.basics.location ? evidence : null,
      advice: country
        ? `This remote role hires in ${country.name.startsWith("United") ? "the " : ""}${country.name} only; apply if you live there and put it in your header.`
        : `If you can work from ${names}, add "Open to relocating to ${names}" next to your location.`,
    },
  ];
}

const notOnResume = (advice: string): Finding[] => [
  { status: "not-on-resume", evidence: null, advice: `Not on your resume; be ready to answer this. ${advice}` },
];
const mentioned = (r: Resume, re: RegExp, advice: string, missing: string): Finding[] => {
  const line = lineWith(r.text, re);
  return line ? [{ status: "met", evidence: `Your resume says "${line}"`, advice }] : notOnResume(missing);
};

// One rule per kind of hard requirement. `test` finds candidate sentences, `check` reads the resume.
const RULES: Rule[] = [
  {
    id: "experience-years",
    label: "Years of experience",
    test: /\bfreshers?\b|\b(years?|yrs?)\b[^.]*\b(experience|exp)\b|\b(experience|exp)\b[^.]*\b(years?|yrs?)\b/i,
    skip: COMPANY_SUBJECT,
    check: checkExperience,
  },
  {
    id: "degree",
    label: "Degree",
    test: /./,
    check: (s, r) => (DEGREES.some((d) => isDegree(d, s)) ? checkDegree(s, r) : []),
  },
  {
    id: "graduation-year",
    label: "Graduation year",
    test: /\b20\d{2}\b[^.]*\b(batch|graduat\w*|pass(ing)?[- ]?outs?)\b|\b(batch|class) of 20\d{2}\b|\bgraduating in 20\d{2}\b/i,
    check: checkGraduationYear,
  },
  { id: "location", label: "Job location", test: /./, check: checkLocation },
  {
    id: "relocation",
    label: "Willing to relocate",
    test: /\brelocat/i,
    skip: /relocation (assistance|support|package|bonus|allowance|benefits?|provided|reimburse\w*)/i,
    check: (_s, r) =>
      mentioned(
        r,
        /relocat/i,
        "Good: recruiters filter on this.",
        'If you are open to moving, add "Open to relocation" next to your location.',
      ),
  },
  {
    id: "work-authorization",
    label: "Work authorization",
    test: /authori[sz]ed to work|work authori[sz]ation|right to work|sponsor|\bvisas?\b|work permit|green card|\bcitizens?(hip)?\b|\bH-?1B\b/i,
    check: (s, r, job) => {
      const name = (COUNTRIES.find((c) => c.re.test(s)) ?? COUNTRIES.find((c) => c.re.test(job)))?.name;
      const country = !name ? "that country" : name.startsWith("United") ? `the ${name}` : name;
      const missing =
        /\bno\b[^.]*sponsor|not (able to |be )?sponsor|unable to sponsor|without (visa )?sponsor|does not sponsor/i.test(
          job,
        )
          ? `This job does not sponsor visas, so apply only if you can already work in ${country}.`
          : `If you can work in ${country} without sponsorship, add "Authorized to work in ${country}" near your location.`;
      return mentioned(
        r,
        /authori[sz]ed to work|work permit|green card|\bcitizen\b|permanent resident/i,
        "Keep it near your location so a recruiter sees it.",
        missing,
      );
    },
  },
  {
    id: "notice-period",
    label: "Notice period",
    test: /immediate(ly)? (joiners?|join|start|available)|notice period|join (within|in) \d+ days|early joiners?|serving notice/i,
    check: (_s, r) =>
      mentioned(
        r,
        /notice period|immediate(ly)? (available|joiner)|available to join/i,
        "Recruiters on Naukri filter on this, so keep it visible.",
        'If your notice period is short, say so in your summary, for example "Notice period: 15 days".',
      ),
  },
  {
    id: "certification",
    label: "Certification",
    test: /./,
    check: (s, r) =>
      CERTS.filter((c) => c.job.test(s)).map((c) => {
        const line = lineWith(r.text, c.resume);
        return line
          ? {
              label: c.label,
              status: "met" as const,
              evidence: `Your resume says "${line}"`,
              advice: "List it under Certifications with the year so a keyword filter finds it.",
            }
          : {
              label: c.label,
              status: "not-met" as const,
              evidence: null,
              advice: `If you hold ${c.label} or are pursuing it (for example "Level I candidate"), list it under Certifications.`,
            };
      }),
  },
  {
    id: "language",
    label: "Language",
    test: new RegExp(
      `\\b(fluen\\w*|proficien\\w*|native|business[- ]level|speak\\w*|written and spoken|spoken and written)\\b[^.]*\\b(${LANGUAGES.slice(1).join("|")})\\b|\\b(${LANGUAGES.slice(1).join("|")})\\b[^.]*\\b(fluen\\w*|proficien\\w*|speak\\w*|native)\\b`,
      "i",
    ),
    check: (s, r) =>
      LANGUAGES.slice(1)
        .filter((l) => new RegExp(`\\b${l}\\b`, "i").test(s))
        .flatMap((l) =>
          mentioned(
            r,
            new RegExp(`\\b${l}\\b`, "i"),
            "Keep it in a Languages line.",
            `If you speak ${l}, add it to a Languages line with your level.`,
          ).map((f) => ({ ...f, label: `${l} language` })),
        ),
  },
  {
    id: "clearance",
    label: "Security clearance",
    test: /\bsecurity clearance\b|\bclearance (required|eligible|eligibility)\b|\btop secret\b|\bTS\/SCI\b|\b(SC|DV) clearance\b/i,
    check: () =>
      notOnResume("If you hold a clearance, name its level; otherwise check whether you are eligible to get one."),
  },
  {
    id: "travel",
    label: "Travel",
    test: /\btravel\w*\b[^.]*(\d{1,3}\s?%|\brequired\b)|\b(willing\w* to|ability to|frequent|extensive|occasional) travel/i,
    check: () => notOnResume("Decide how much travel you can take before the interview."),
  },
  {
    id: "shift",
    label: "Shift timings",
    test: /\b(night|rotational|rotating|graveyard|evening|US|UK|EST|PST) shifts?\b|\b24 ?(x|\/) ?7\b|\bweekend (work|shifts?)\b|\bshift timings?\b/i,
    check: () => notOnResume("Check that you can work these hours before applying."),
  },
];

type Sentence = { text: string; kind: "req" | "pref" | "other" };

function jobSentences(jobText: string) {
  const out: Sentence[] = [];
  let kind: Sentence["kind"] | "blurb" = "other";
  let sectioned = false;
  for (const raw of jobText.split("\n")) {
    const line = raw.replace(/^[\s>#*•·▪●-]+|\*+$/g, "").trim();
    if (!line) continue;
    const isHeading =
      line.split(/\s+/).length <= 6 && !/[.;]$/.test(line) && !/:\s*\S/.test(line) && !/^[-*•]/.test(raw.trim());
    const heading = isHeading ? line.replace(/:$/, "") : "";
    if (heading && (BLURB_HEADING.test(heading) || PREFERRED.test(heading) || REQ_HEADING.test(heading))) {
      kind = BLURB_HEADING.test(heading) ? "blurb" : PREFERRED.test(heading) ? "pref" : "req";
      sectioned ||= kind !== "blurb";
      continue;
    }
    if (kind === "blurb") continue;
    for (const text of line.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/)) out.push({ text: text.trim(), kind });
  }
  // With requirement headings, their sentences win over the same requirement mentioned elsewhere.
  return sectioned ? [...out.filter((s) => s.kind !== "other"), ...out.filter((s) => s.kind === "other")] : out;
}

export function findKnockouts(jobText: string, resume: { text: string; content?: ResumeContent }): Knockout[] {
  const found = new Map<string, Knockout>();
  for (const sentence of jobSentences(jobText)) {
    for (const rule of RULES) {
      if (!rule.test.test(sentence.text) || rule.skip?.test(sentence.text)) continue;
      for (const { label = rule.label, ...finding } of rule.check(sentence.text, resume, jobText)) {
        const key = `${rule.id}:${label}`;
        if (found.has(key)) continue;
        const required = sentence.kind !== "pref" && !PREFERRED.test(sentence.text);
        found.set(key, { id: rule.id, label, requirement: clip(sentence.text), required, ...finding });
      }
    }
  }
  // Evidence quotes the resume as extracted, which can carry icon-font glyphs and typographic dashes.
  const clean = (value: string) =>
    value
      .replace(/[\uE000-\uF8FF\uFFFD]/g, "")
      .replace(/\s*[\u2013\u2014]\s*/g, " - ")
      .replace(/\s{2,}/g, " ")
      .trim();
  return [...found.values()]
    .map((knockout) => ({ ...knockout, evidence: knockout.evidence && clean(knockout.evidence) }))
    .sort((a, b) => Number(b.required) - Number(a.required))
    .slice(0, MAX_KNOCKOUTS);
}
