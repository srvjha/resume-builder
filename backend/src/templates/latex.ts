import type { ResumeContent } from "../schemas/resume-content.js";
import type { ResumeLayout } from "./layout.js";

const latexSpecials: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

// All user text goes through this, so user input can never inject LaTeX commands.
export function tex(value: string | undefined | null): string {
  return (value ?? "").replace(/[\\&%$#_{}~^]/g, (char) => latexSpecials[char]!);
}

// Escapes text and turns **bold** markers into \textbf{}.
export function texRich(value: string | undefined | null): string {
  return (value ?? "")
    .split(/\*\*(.+?)\*\*/g)
    .map((part, index) => (index % 2 === 1 ? `\\textbf{${tex(part)}}` : tex(part)))
    .join("");
}

export function texUrl(url: string): string {
  return url.replace(/[\\%#{}]/g, (char) => `\\${char}`);
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value: string | undefined) {
  if (!value) return "";
  if (value === "present") return "Present";
  const [year, month] = value.split("-");
  return month ? `${months[Number(month) - 1]} ${year}` : year!;
}

export function dateRange(start?: string, end?: string) {
  const from = formatDate(start);
  const to = formatDate(end);
  if (from && to) return `${from} -- ${to}`;
  return from || to;
}

export function joinNonEmpty(parts: (string | undefined)[], separator: string) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(separator);
}

// Drops everything the user hid, so templates only deal with what is shown.
export function visibleContent(content: ResumeContent): ResumeContent {
  return {
    basics: content.basics,
    sections: content.sections
      // A skills section added a moment ago has one empty group, and an itemize with nothing in it doesn't compile.
      .filter((section) => !section.hidden && (section.type !== "skills" || section.groups.some((g) => g.items.length > 0)))
      .map((section) => {
        // Templates print "Group: items", so a name typed as "Frontend:" would show two colons.
        if (section.type === "skills")
          return {
            ...section,
            groups: section.groups
              .filter((g) => g.items.length > 0)
              .map((g) => ({ ...g, name: g.name.replace(/\s*:+$/, "") })),
          };
        if (section.type === "links" || section.type === "summary") return section;
        const entries = section.entries
          .filter((entry) => !entry.hidden)
          .map((entry) => ({ ...entry, bullets: entry.bullets.filter((bullet) => !bullet.hidden) }));
        return { ...section, entries } as typeof section;
      }),
  };
}

// A project heading is one unwrapped line; past this many characters it runs off the page,
// so the tech list moves to its own line under the heading.
// ponytail: counts characters, not rendered width; a font-aware measure would be exact.
export const fitsOneLine = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" | ").length <= 75;

type ListEntry = Extract<ResumeContent["sections"][number], { type: "list" }>["entries"][number];

// The extra space a user asked for after an entry; nothing when unset, so other resumes render unchanged.
export const gap = (e: { spaceAfter?: number | undefined }) => (e.spaceAfter ? `\n\\vspace{${e.spaceAfter}pt}` : "");

// A rendered section followed by the space the user asked for; empty sections stay empty.
export const withGap = (rendered: string, s: { spaceAfter?: number | undefined }) => rendered && rendered + gap(s);

// Achievements and certifications without bullets of their own read best as one tight bulleted list:
// "Name, a dash, description" with the name bold (and linked), or the item as plain text when it is one sentence.
export function compactList(entries: ListEntry[]) {
  const items = entries.map((e) => {
    // A linked name stays bold (underlines collide with the next line here); a linked sentence gets a link icon.
    const title = !e.url
      ? e.subtitle
        ? `\\textbf{${texRich(e.title)}}`
        : texRich(e.title)
      : e.subtitle
        ? `\\href{${texUrl(e.url)}}{\\textbf{${texRich(e.title)}}}`
        : `${texRich(e.title)}\\,\\href{${texUrl(e.url)}}{${icon("\\faLink")}}`;
    const subtitle = e.subtitle ? ` -- ${texRich(e.subtitle)}` : "";
    const date = e.date ? ` (${tex(e.date)})` : "";
    return `  \\item \\small{${title}${subtitle}${date}}${gap(e)}`;
  });
  return `\\begin{itemize}[leftmargin=0.15in, itemsep=1pt, parsep=0pt, topsep=2pt]\n${items.join("\n")}\n\\end{itemize}`;
}

// fontawesome5 has no X logo yet, so x.com links keep the bird.
const linkIcons: [RegExp, string][] = [
  [/linkedin/, "\\faLinkedin"],
  [/github/, "\\faGithub"],
  [/gitlab/, "\\faGitlab"],
  [/twitter|x\.com/, "\\faTwitter"],
  [/kaggle/, "\\faKaggle"],
  [/medium\.com/, "\\faMedium"],
  [/behance/, "\\faBehance"],
  [/dribbble/, "\\faDribbble"],
  [/stackoverflow/, "\\faStackOverflow"],
  [/youtube/, "\\faYoutube"],
  [/instagram/, "\\faInstagram"],
  [/leetcode|codeforces|codechef|hackerrank|geeksforgeeks/, "\\faCode"],
];

// Empty ActualText keeps the icon glyphs out of copied text and what an ATS reads.
const icon = (name: string) => `\\BeginAccSupp{ActualText={}}\\raisebox{-0.1\\height}{${name}}\\EndAccSupp{}\\,`;
const iconLink = (url: string, name: string, label: string) =>
  `\\href{${texUrl(url)}}{${icon(name)}\\underline{${tex(label)}}}`;

// A link as it reads on the page: "linkedin.com/in/aarav", not "https://www.linkedin.com/in/aarav/".
export const displayUrl = (url: string) =>
  url
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");

// Contact details with an icon each; email and links are underlined and clickable. Templates load fontawesome5
// and accsupp. Links show their address, not a label like "LinkedIn": an ATS keeps only the visible text, so a
// label alone leaves the recruiter without the address.
// "icon" shows profile links as a clickable icon alone, so an ATS and a printed copy lose the address (the
// editor says so); "text" drops every icon. Email and phone always stay readable.
export function contactParts(basics: ResumeContent["basics"], links?: ResumeLayout["links"]) {
  const mark = (name: string) => (links === "text" ? "" : icon(name));
  return (
    [
      basics.phone ? `${mark("\\faPhone")}${tex(basics.phone)}` : undefined,
      basics.email
        ? links === "text"
          ? `\\href{${texUrl(`mailto:${basics.email}`)}}{\\underline{${tex(basics.email)}}}`
          : iconLink(`mailto:${basics.email}`, "\\faEnvelope", basics.email)
        : undefined,
      basics.location ? `${mark("\\faMapMarker")}${tex(basics.location)}` : undefined,
      ...basics.links.map((link) => {
        const target = `${link.label} ${link.url}`.toLowerCase();
        const name = linkIcons.find(([pattern]) => pattern.test(target))?.[1] ?? "\\faGlobe";
        const address = displayUrl(link.url);
        if (links === "icon") return `\\href{${texUrl(link.url)}}{${icon(name).replace(/\\,$/, "")}}`;
        if (links === "text") return `\\href{${texUrl(link.url)}}{\\underline{${tex(address)}}}`;
        return iconLink(link.url, name, address);
      }),
    ]
      .filter((part): part is string => Boolean(part))
      // A long contact line wraps between items (templates join them with spacing that can't break on its
      // own), never inside a phone number or address.
      .map((part) => `\\allowbreak\\mbox{${part}}`)
  );
}
