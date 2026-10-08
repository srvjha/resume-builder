import type { ResumeContent } from "../schemas/resume-content.js";
import { contactParts, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import { bundleFont, renderBody } from "./shared-tech.js";

// Roomy, outcome-first layout for product managers: a heavy accent rule under the header,
// sentence-case headings, company names in the accent color and square bullets.
const preamble = String.raw`\documentclass[a4paper,11pt]{article}
\usepackage[a4paper,top=0.6in,bottom=0.6in,left=0.75in,right=0.75in]{geometry}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
${bundleFont("Inter")}
\newfontface\semibold{Inter-SemiBold.otf}

\definecolor{ink}{HTML}{111827}
\definecolor{accent}{HTML}{15803D}
\definecolor{muted}{HTML}{6B7280}
\definecolor{hairline}{HTML}{D1D5DB}
\color{ink}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\setlength{\parindent}{0pt}
\titleformat{\section}{\large\semibold}{}{0em}{}[\vspace{2pt}{\color{hairline}\titlerule}]
\titlespacing*{\section}{0pt}{*3.2}{*1.6}

\newcommand{\resumeItem}[1]{\item{\small #1}}
\newcommand{\resumeSubheading}[4]{
  \item
  \begin{tabular*}{\linewidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & \small\textcolor{muted}{#2} \\
    \semibold\textcolor{accent}{#3} & \small\textcolor{muted}{#4} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeProjectHeading}[2]{
  \item
  \begin{tabular*}{\linewidth}{l@{\extracolsep{\fill}}r}
    #1 & \small\textcolor{muted}{#2} \\
  \end{tabular*}\ignorespaces
}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0pt, label={}, topsep=0pt]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=1.1em, label={\textcolor{accent}{\rule[0.3ex]{3.5pt}{3.5pt}}}, topsep=2pt, parsep=0pt]}
\newcommand{\resumeItemListEnd}{\end{itemize}}
`;

export function renderProductManager(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  return applyLayout(
    String.raw`${preamble}
\begin{document}
{\fontsize{26pt}{30pt}\selectfont\bfseries ${tex(basics.name)}}${nameGap(layout)}\par\vspace{4pt}
${basics.headline ? String.raw`{\large\semibold\color{accent} ${tex(basics.headline)}}\par\vspace{3pt}` : ""}
{\small\color{muted} ${contactParts(basics, layout?.links).join("\\hspace{10pt}")}}\par
\vspace{6pt}{\color{accent}\rule{\linewidth}{2.5pt}}

${renderBody(sections)}
\end{document}
`,
    layout,
  );
}
