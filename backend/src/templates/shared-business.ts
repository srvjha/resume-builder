import type { ResumeSection } from "../schemas/resume-content.js";
import { dateRange, joinNonEmpty, tex, texRich, texUrl, gap, withGap, displayUrl } from "./latex.js";

// Section bodies shared by the business templates (banking, finance, consulting, marketing, executive).
// Each template defines these macros in its preamble and lays them out its own way:
// \expentry{organization}{role}{location}{dates}, \eduentry{institution}{degree}{score}{location}{dates},
// \projentry{name}{technologies}{links}{dates}, \listentry{title}{subtitle}{date}, \skillline{group}{items},
// \summarytext{text}, \linkline{links} with \linksep between links, and \competencies{group}{items}
// with \compsep between items when the competencies option is on.
// Bullets are a plain itemize, so the layout presets apply to them.

// TeX Gyre fonts have no rupee sign; borrow it from EB Garamond, which does.
export const rupeeFallback = String.raw`\usepackage{newunicodechar}
\newfontfamily\rupeefont{EBGaramond}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic]
\newunicodechar{₹}{{\rupeefont ₹}}`;

// \ifnonempty{value}{output} prints output only when value has content; \joinwith{a}{separator}{b}
// puts the separator between a and b only when both are there. Blank fields leave no stray separators.
// Bullet lists are set with the global \setlist, since the layout presets replace \setlist[itemize].
export const businessMacros = String.raw`\newcommand{\ifnonempty}[2]{\if\relax\detokenize{#1}\relax\else#2\fi}
\newcommand{\joinwith}[3]{#1\ifnonempty{#1}{\ifnonempty{#3}{#2}}#3}`;

export const isSummary = (s: ResumeSection) =>
  s.type === "summary" || (s.type === "list" && /summary|profile|about|objective/i.test(s.title));
export const isCertifications = (s: ResumeSection) =>
  s.type === "list" && /certif|licen|credential|qualification|charter/i.test(s.title);
export const isBoard = (s: ResumeSection) => s.type === "list" && /board|director|advis|governance/i.test(s.title);

const year = (value?: string) => (value === "present" ? Infinity : value ? Number(value.slice(0, 4)) : undefined);

// Students and recent graduates lead with education. Someone with two roles since graduating, or one
// that started 3+ years after it, leads with experience.
// ponytail: judged from dates alone; a user-set "career stage" would be exact.
export function leadsWithEducation(sections: ResumeSection[]) {
  const graduated = Math.max(
    ...sections.flatMap((s) =>
      s.type === "education" ? s.entries.map((e) => year(e.end) ?? year(e.start) ?? -Infinity) : [],
    ),
  );
  if (!Number.isFinite(graduated)) return true;
  const since = sections
    .flatMap((s) => (s.type === "experience" ? s.entries.map((e) => year(e.start)) : []))
    .filter((start): start is number => start !== undefined && start >= graduated);
  return since.length < 2 && !since.some((start) => start - graduated >= 3);
}

// Stable sort by rank, so sections with the same rank keep the user's order and nothing is dropped.
export const orderSections = (sections: ResumeSection[], rank: (s: ResumeSection) => number) =>
  [...sections].sort((a, b) => rank(a) - rank(b));

function bullets(items: { text: string }[]) {
  if (items.length === 0) return "";
  return ["\\begin{itemize}", ...items.map((item) => `  \\item ${texRich(item.text)}`), "\\end{itemize}"].join("\n");
}

const linked = (url: string | undefined, label: string) => (url ? `\\href{${texUrl(url)}}{${tex(label)}}` : tex(label));

export type BusinessOptions = {
  // Renders skills as a flowing keyword block via \competencies instead of one line per group.
  competencies?: boolean;
  // Shows the organization once for consecutive roles at the same company.
  groupRoles?: boolean;
};

function renderBody(s: ResumeSection, options: BusinessOptions): string {
  if (isSummary(s) && s.type === "list") {
    return s.entries
      .map((e) =>
        [
          e.title || e.subtitle ? `\\summarytext{${tex(joinNonEmpty([e.title, e.subtitle], " "))}}` : "",
          bullets(e.bullets) + gap(e),
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n");
  }
  switch (s.type) {
    case "experience":
      return s.entries
        .map((e, i) => {
          const repeat = options.groupRoles && i > 0 && s.entries[i - 1]!.organization === e.organization;
          return [
            `\\expentry{${repeat ? "" : tex(e.organization)}}{${tex(e.role)}}{${repeat ? "" : tex(e.location)}}{${dateRange(e.start, e.end)}}`,
            bullets(e.bullets) + gap(e),
          ].join("\n");
        })
        .join("\n");
    case "education":
      return s.entries
        .map((e) =>
          [
            `\\eduentry{${tex(e.institution)}}{${tex(joinNonEmpty([e.degree, e.field], ", "))}}{${tex(e.score)}}{${tex(e.location)}}{${dateRange(e.start, e.end)}}`,
            bullets(e.bullets) + gap(e),
          ].join("\n"),
        )
        .join("\n");
    case "projects":
      return s.entries
        .map((e) =>
          [
            `\\projentry{${linked(e.url, e.name)}}{${tex(e.technologies.join(", "))}}{${e.links.map((l) => linked(l.url, l.label)).join(", ")}}{${dateRange(e.start, e.end)}}`,
            bullets(e.bullets) + gap(e),
          ].join("\n"),
        )
        .join("\n");
    case "list":
      return s.entries
        .map((e) =>
          [
            `\\listentry{${linked(e.url, e.title)}}{${tex(e.subtitle)}}{${tex(e.date)}}`,
            bullets(e.bullets) + gap(e),
          ].join("\n"),
        )
        .join("\n");
    case "skills": {
      const groups = s.groups.filter((g) => g.items.length > 0);
      if (options.competencies) {
        // One unnamed keyword block reads best; group names only show when there are several.
        return groups
          .map((g) => {
            const items = g.items.map((item) => `\\mbox{${tex(item)}}`).join("\\compsep ");
            return `\\competencies{${groups.length > 1 ? tex(g.name) : ""}}{${items}}`;
          })
          .join("\n");
      }
      return groups.map((g) => `\\skillline{${tex(g.name)}}{${tex(g.items.join(", "))}}`).join("\n");
    }
    case "summary":
      return s.text ? `\\summarytext{${texRich(s.text)}}` : "";
    case "links":
      return s.links.length
        ? `\\linkline{${s.links.map((l) => `\\mbox{${tex(l.label)}: ${linked(l.url, displayUrl(l.url))}}`).join("\\linksep ")}}`
        : "";
  }
}

export function renderBusinessSections(sections: ResumeSection[], options: BusinessOptions = {}) {
  return sections
    .map((s) => {
      const body = renderBody(s, options);
      return body ? withGap(`\\section{${tex(s.title)}}\n${body}`, s) : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
