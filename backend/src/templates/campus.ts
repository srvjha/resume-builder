import type { ResumeContent, ResumeSection } from "../schemas/resume-content.js";
import { contactParts, dateRange, joinNonEmpty, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import { bullets, renderBody } from "./shared-tech.js";

// Campus placement format: education first as a table of degree, institution, score and year,
// shaded section bars and a dense single column for projects, internships and achievements.
const preamble = String.raw`\documentclass[a4paper,10pt]{article}
\usepackage[a4paper,top=0.45in,bottom=0.45in,left=0.5in,right=0.5in]{geometry}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage{tabularx}
\usepackage{booktabs}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
\setmainfont{NotoSerif}[Extension=.ttf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic]

\definecolor{shade}{HTML}{E5E7EB}
\definecolor{muted}{HTML}{4B5563}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\setlength{\parindent}{0pt}
\newcommand{\sectionbar}[1]{\colorbox{shade}{\parbox{\dimexpr\linewidth-2\fboxsep}{\strut\MakeUppercase{#1}}}}
\titleformat{\section}{\normalsize\bfseries}{}{0em}{\sectionbar}
\titlespacing*{\section}{0pt}{*2}{*1}
\newcolumntype{L}{>{\raggedright\arraybackslash}X}

\newcommand{\resumeItem}[1]{\item{#1}}
\newcommand{\resumeSubheading}[4]{
  \item
  \begin{tabular*}{\linewidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & \textbf{\small #2} \\
    \textit{\small #3} & \textit{\small #4} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeProjectHeading}[2]{
  \item
  \begin{tabular*}{\linewidth}{l@{\extracolsep{\fill}}r}
    #1 & \textbf{\small #2} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0pt, label={}, topsep=0pt, parsep=0pt]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=1.1em, label={\textbullet}, topsep=0pt, parsep=0pt]}
\newcommand{\resumeItemListEnd}{\end{itemize}}
`;

const gap = "@{\\hspace{8pt}}";

function education(s: Extract<ResumeSection, { type: "education" }>) {
  if (s.entries.length === 0) return "";
  const rows = s.entries.map((e) => {
    const row = `${tex(joinNonEmpty([e.degree, e.field], ", "))} & ${tex(joinNonEmpty([e.institution, e.location], ", "))} & ${tex(e.score)} & ${dateRange(e.start, e.end)} \\\\`;
    const list = bullets(e.bullets);
    // Table rows take extra space through booktabs, not \\vspace.
    const space = e.spaceAfter ? `\n\\addlinespace[${e.spaceAfter}pt]` : "";
    return (list ? `${row}\n\\multicolumn{4}{@{}p{\\linewidth}@{}}{${list}} \\\\` : row) + space;
  });
  return String.raw`\section{${tex(s.title)}}
{\small\begin{tabularx}{\linewidth}{@{}L${gap}L${gap}l${gap}r@{}}
\toprule
\textbf{Degree} & \textbf{Institution} & \textbf{Score} & \textbf{Year} \\
\midrule
${rows.join("\n")}
\bottomrule
\end{tabularx}}`;
}

export function renderCampus(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  const ordered = [
    ...sections.filter((s) => s.type === "education"),
    ...sections.filter((s) => s.type !== "education"),
  ];
  const body = renderBody(ordered, (s) => (s.type === "education" ? education(s) : undefined));
  const contacts = contactParts(basics);
  const contactLines = [contacts.slice(0, 2), contacts.slice(2, 4), contacts.slice(4)]
    .map((line) => line.join(" \\textbar{} "))
    .filter(Boolean);
  return applyLayout(
    String.raw`${preamble}
\begin{document}
\begin{minipage}[t]{0.5\linewidth}
  {\LARGE\bfseries ${tex(basics.name)}}${nameGap(layout)}\par\vspace{2pt}
  ${basics.headline ? String.raw`{\small ${tex(basics.headline)}}` : ""}
\end{minipage}%
\begin{minipage}[t]{0.5\linewidth}
  \raggedleft\small
  ${contactLines.join(" \\\\\n  ")}
\end{minipage}

${body}
\end{document}
`,
    layout,
  );
}
