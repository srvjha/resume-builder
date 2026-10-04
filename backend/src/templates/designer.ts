import type { ResumeContent, ResumeSection } from "../schemas/resume-content.js";
import { renderSections } from "./classic-body.js";
import { contactParts, dateRange, joinNonEmpty, tex, texUrl, visibleContent, gap, withGap } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import { bullets, bundleFont, displayUrl } from "./shared-tech.js";

// Two-column layout for UI/UX and product designers: a light display name, a narrow sidebar for contact,
// skills, education and short lists, and the main column for experience and work. paracol lets both
// columns run onto a second page.
const preamble = String.raw`\documentclass[a4paper,10pt]{article}
\usepackage[a4paper,top=0.6in,bottom=0.6in,left=0.6in,right=0.6in]{geometry}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage{paracol}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
${bundleFont("FiraSans")}
\newfontface\light{FiraSans-Light.otf}
\newfontface\caps{FiraSans-SemiBold.otf}[LetterSpace=10]

\definecolor{ink}{HTML}{1C1917}
\definecolor{accent}{HTML}{C2410C}
\definecolor{muted}{HTML}{78716C}
\definecolor{hairline}{HTML}{E7E5E4}
\color{ink}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\setlength{\parindent}{0pt}
\titleformat{\section}{\color{accent}\footnotesize\caps}{}{0em}{\MakeUppercase}
\titlespacing*{\section}{0pt}{*3}{*1.4}
\columnratio{0.29}
\setlength{\columnsep}{20pt}
\setlength{\columnseprule}{0.4pt}
\colseprulecolor{hairline}

\newcommand{\resumeItem}[1]{\item{#1}}
\newcommand{\resumeSubheading}[4]{
  \item
  \begin{tabular*}{\linewidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & \small\textcolor{muted}{#2} \\
    #3 & \small\textcolor{muted}{#4} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeProjectHeading}[2]{
  \item
  \begin{tabular*}{\linewidth}{l@{\extracolsep{\fill}}r}
    #1 & \small\textcolor{muted}{#2} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0pt, label={}, topsep=0pt, parsep=0pt]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=0.9em, label={\textcolor{accent}{\textbullet}}, topsep=1pt, parsep=0pt]}
\newcommand{\resumeItemListEnd}{\end{itemize}}
\newcommand{\sideEntry}[1]{\par\vspace{5pt}{\small #1}\par}
`;

// Lets long URLs wrap at slashes in the narrow sidebar.
const breakable = (url: string) => tex(displayUrl(url)).replace(/\//g, "/\\hspace{0pt}");
const sideLink = (url: string, text: string) => `\\href{${texUrl(url)}}{${text}}`;
const lines = (parts: (string | undefined)[]) => joinNonEmpty(parts, "\\\\\n");

function inSidebar(s: ResumeSection) {
  if (s.type === "skills" || s.type === "links" || s.type === "education") return true;
  return s.type === "list" && s.entries.every((e) => e.bullets.length === 0);
}

function sidebarSection(s: ResumeSection): string {
  const entries = (() => {
    switch (s.type) {
      case "skills":
        return s.groups
          .filter((g) => g.items.length > 0)
          .map((g) => lines([`\\textbf{${tex(g.name)}}`, tex(g.items.join(", "))]));
      case "links":
        return s.links.map((l) => lines([`\\textbf{${tex(l.label)}}`, sideLink(l.url, breakable(l.url))]));
      case "education":
        return s.entries.map((e) =>
          [
            lines([
              `\\textbf{${tex(e.institution)}}`,
              tex(joinNonEmpty([e.degree, e.field], ", ")),
              tex(e.score),
              `\\textcolor{muted}{${joinNonEmpty([dateRange(e.start, e.end), tex(e.location)], ", ")}}`,
            ]),
            bullets(e.bullets) + gap(e),
          ]
            .filter(Boolean)
            .join("\n"),
        );
      case "list":
        return s.entries.map(
          (e) =>
            lines([
              e.url ? sideLink(e.url, `\\textbf{${tex(e.title)}}`) : `\\textbf{${tex(e.title)}}`,
              tex(e.subtitle),
              e.date ? `\\textcolor{muted}{${tex(e.date)}}` : undefined,
            ]) + gap(e),
        );
      default:
        return [];
    }
  })().filter(Boolean);
  if (entries.length === 0) return "";
  return `\\section{${tex(s.title)}}\n${entries.map((e) => `\\sideEntry{${e}}`).join("\n")}`;
}

function contact(basics: ResumeContent["basics"]) {
  const parts = contactParts(basics);
  if (parts.length === 0) return "";
  return `\\section{Contact}\n${parts.map((p) => `\\sideEntry{${p}}`).join("\n")}`;
}

export function renderDesigner(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  const side = [contact(basics), ...sections.filter(inSidebar).map((s) => withGap(sidebarSection(s), s))].filter(
    Boolean,
  );
  const main = renderSections(sections.filter((s) => !inSidebar(s)));
  return applyLayout(
    String.raw`${preamble}
\begin{document}
{\fontsize{34pt}{38pt}\selectfont\light ${tex(basics.name)}}${nameGap(layout)}\par\vspace{6pt}
${basics.headline ? String.raw`{\color{accent}\caps\small\MakeUppercase{${tex(basics.headline)}}}\par` : ""}
\vspace{10pt}
\begin{paracol}{2}
${side.join("\n\n")}
\switchcolumn
${main}
\end{paracol}
\end{document}
`,
    layout,
  );
}
