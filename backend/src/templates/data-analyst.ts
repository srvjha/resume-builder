import type { ResumeContent, ResumeSection } from "../schemas/resume-content.js";
import { contactParts, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import { bundleFont, renderBody } from "./shared-tech.js";

// Dense sans layout for data scientists and analysts: accent-bar headings, a two-column skills block
// that reads like a key and value list, and muted metadata so the numbers in bullets stand out.
const preamble = String.raw`\documentclass[a4paper,10pt]{article}
\usepackage[a4paper,top=0.5in,bottom=0.5in,left=0.6in,right=0.6in]{geometry}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
${bundleFont("IBMPlexSans")}
\newfontface\headingfont{IBMPlexSans-SemiBold.otf}[LetterSpace=6]

\definecolor{accent}{HTML}{1F5C99}
\definecolor{muted}{HTML}{5B6573}
\definecolor{hairline}{HTML}{C9D1DB}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\setlength{\parindent}{0pt}
\titleformat{\section}{\color{accent}\small\headingfont}{}{0em}{{\color{accent}\rule[-0.25ex]{3pt}{1.9ex}}\hspace{6pt}\MakeUppercase}[\vspace{1pt}{\color{hairline}\titlerule}]
\titlespacing*{\section}{0pt}{*2.4}{*1.4}

\newcommand{\resumeItem}[1]{\item{#1}}
\newcommand{\resumeSubheading}[4]{
  \item
  \begin{tabular*}{\linewidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & \textcolor{muted}{#2} \\
    \textcolor{accent}{#3} & \textcolor{muted}{\small #4} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeProjectHeading}[2]{
  \item
  \begin{tabular*}{\linewidth}{l@{\extracolsep{\fill}}r}
    #1 & \textcolor{muted}{#2} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0pt, label={}, topsep=0pt, parsep=0pt]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=1.1em, label={\textcolor{accent}{\textbullet}}, topsep=1pt, parsep=0pt]}
\newcommand{\resumeItemListEnd}{\end{itemize}}
`;

function skills(s: Extract<ResumeSection, { type: "skills" }>) {
  const groups = s.groups.filter((group) => group.items.length > 0);
  if (groups.length === 0) return "";
  const items = groups.map((g) => `  \\item[{\\textbf{${tex(g.name)}}}] ${tex(g.items.join(", "))}`);
  return `\\section{${tex(s.title)}}\n\\begin{itemize}[leftmargin=1.5in, labelwidth=1.4in, labelsep=0.1in, align=left, topsep=0pt, parsep=0pt]\n${items.join("\n")}\n\\end{itemize}`;
}

export function renderDataAnalyst(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  const body = renderBody(sections, (s) => (s.type === "skills" ? skills(s) : undefined));
  const headline = basics.headline ? String.raw`\hspace{10pt}{\color{accent}\Large ${tex(basics.headline)}}` : "";
  return applyLayout(
    String.raw`${preamble}
\begin{document}
{\fontsize{22pt}{26pt}\selectfont\bfseries ${tex(basics.name)}}${headline}${nameGap(layout)}\par\vspace{4pt}
{\small\color{muted} ${contactParts(basics, layout?.links).join("\\hspace{4pt}{\\color{hairline}|}\\hspace{4pt}")}}\par

${body}
\end{document}
`,
    layout,
  );
}
