// Every word list the ATS score uses, kept small and in one place.

// Base forms; "-ed", "-d", "-s" and "-ing" forms match too, and any other word ending in "-ed" counts.
export const ACTION_VERBS = new Set(
  (
    "achieve analyze analyse architect automate boost build chair coordinate create cut debug decrease deliver " +
    "deploy design develop direct drive enable engineer establish execute expand found generate grow head " +
    "implement improve increase integrate introduce launch lead maintain manage mentor migrate optimize optimise " +
    "organize organise own pioneer plan present produce program publish rank raise reduce refactor research " +
    "resolve restructure revamp rewrite save scale secure ship simplify solve spearhead speed streamline " +
    "supervise teach test train transform troubleshoot unify upgrade win write"
  ).split(" "),
);

// Irregular past tenses of the verbs above.
export const IRREGULAR_VERBS = new Set([
  "built",
  "cut",
  "drove",
  "founded",
  "grew",
  "led",
  "ran",
  "won",
  "wrote",
  "taught",
  "set",
  "made",
  "held",
  "kept",
  "oversaw",
  "rebuilt",
  "rewrote",
  "sold",
  "took",
  "undertook",
  "upheld",
  "brought",
  "began",
  "chose",
  "drew",
  "gave",
  "spoke",
  "spent",
  "sent",
]);

export const CLICHES = [
  "team player",
  "hard working",
  "hardworking",
  "detail oriented",
  "results driven",
  "self motivated",
  "go getter",
  "think outside the box",
  "synergy",
  "dynamic individual",
  "quick learner",
  "responsible for",
  "duties included",
  "worked on",
  "helped with",
];

// Heading text (lowercased, letters only) mapped to the section an ATS files it under.
export const SECTION_HEADINGS: { id: string; pattern: RegExp }[] = [
  { id: "summary", pattern: /^(professional |career )?(summary|profile|objective|about me|about)$/ },
  {
    id: "experience",
    pattern:
      /^((work|professional|relevant|industry|internship) )?(experience|employment( history)?|work history|internships?)$/,
  },
  {
    id: "education",
    pattern: /^(education|academics?|academic (background|details|qualifications)|educational qualifications?)$/,
  },
  {
    id: "skills",
    pattern:
      /^((technical|core|key|relevant) )?(skills|competencies|skill set|technologies|tech stack)( (and|&) [a-z]+( [a-z]+)?)?$/,
  },
  { id: "projects", pattern: /^((personal|academic|key|selected|technical|side|relevant|major) )?projects$/ },
  { id: "certifications", pattern: /^((licenses|licences) (and|&) )?certifications?( (and|&) [a-z]+)?$|^courses$/ },
  {
    id: "achievements",
    pattern: /^(achievements|accomplishments|awards|honou?rs)( (and|&) (achievements|awards|honou?rs|[a-z]+))?$/,
  },
  {
    id: "leadership",
    pattern:
      /^(positions? of responsibility|leadership( experience)?|extra ?curricular( activities)?|activities|volunteer(ing| experience)?)$/,
  },
  { id: "publications", pattern: /^(publications|research( experience)?)$/ },
  { id: "coursework", pattern: /^(relevant )?coursework$/ },
  { id: "links", pattern: /^(links|profiles|coding profiles)$/ },
];
