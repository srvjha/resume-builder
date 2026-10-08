import type { ResumeContent, ResumeSection } from "../schemas/resume-content.js";
import { contactParts, joinNonEmpty, tex, texUrl, visibleContent, gap } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import { bullets, bundleFont, isPublications, renderBody } from "./shared-tech.js";

// Academic-leaning CV for ML engineers and researchers: serif type, small-caps headings with a leader rule,
// and numbered, citation-style entries for any list section titled Publications or Papers.
const preamble = String.raw`\documentclass[a4paper,11pt]{article}
\usepackage[a4paper,top=0.6in,bottom=0.6in,left=0.7in,right=0.7in]{geometry}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
${bundleFont("LibertinusSerif")}

\definecolor{accent}{HTML}{7A1F2B}
\definecolor{muted}{HTML}{4A4A4A}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\setlength{\parindent}{0pt}
\newcommand{\sectionfill}[1]{#1\hspace{0.5em}\leaders\hbox{\rule[0.55ex]{1pt}{0.5pt}}\hfill\kern0pt}
\titleformat{\section}{\large\scshape\color{accent}}{}{0em}{\sectionfill}
\titlespacing*{\section}{0pt}{*2.6}{*1.2}

\newcommand{\resumeItem}[1]{\item{#1}}
\newcommand{\resumeSubheading}[4]{
  \item
  \begin{tabular*}{\linewidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & \textit{#2} \\
    \textit{#3} & \textcolor{muted}{\small #4} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeProjectHeading}[2]{
  \item
  \begin{tabular*}{\linewidth}{l@{\extracolsep{\fill}}r}
    #1 & \textit{#2} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0pt, label={}, topsep=0pt, parsep=0pt]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=1.4em, label={\textcolor{accent}{\small$\circ$}}, topsep=1pt, parsep=0pt]}
\newcommand{\resumeItemListEnd}{\end{itemize}}
`;

function publications(s: Extract<ResumeSection, { type: "list" }>) {
  if (s.entries.length === 0) return "";
  const items = s.entries.map((e) => {
    const title = e.url ? `\\href{${texUrl(e.url)}}{\\textbf{${tex(e.title)}}}` : `\\textbf{${tex(e.title)}}`;
    const cite = joinNonEmpty([title, e.subtitle ? `\\textit{${tex(e.subtitle)}}` : undefined, tex(e.date)], ". ");
    return [`\\item ${cite}.`, bullets(e.bullets) + gap(e)].filter(Boolean).join("\n");
  });
  return `\\section{${tex(s.title)}}\n\\begin{enumerate}[label={\\textcolor{accent}{[\\arabic*]}}, leftmargin=2.2em, topsep=0pt, parsep=0pt, itemsep=2pt]\n${items.join("\n")}\n\\end{enumerate}`;
}

export function renderMlResearch(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  const body = renderBody(sections, (s) => (isPublications(s) ? publications(s) : undefined));
  return applyLayout(
    String.raw`${preamble}
\begin{document}
{\fontsize{24pt}{28pt}\selectfont\scshape\color{accent} ${tex(basics.name)}}${nameGap(layout)}\par\vspace{3pt}
${basics.headline ? String.raw`{\itshape ${tex(basics.headline)}}\par\vspace{2pt}` : ""}
{\small ${contactParts(basics, layout?.links).join("\\enspace\\textperiodcentered\\enspace ")}}\par
\vspace{4pt}{\color{accent}\rule{\linewidth}{0.8pt}}

${body}
\end{document}
`,
    layout,
  );
}
