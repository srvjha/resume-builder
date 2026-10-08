import type { ResumeContent } from "../schemas/resume-content.js";
import { renderSections } from "./classic-body.js";
import { contactParts, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import { sharedMacros } from "./macros.js";

// Based on Jake Gutierrez's resume template (MIT), adapted for XeTeX.
export function renderJake(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  return applyLayout(
    String.raw`\documentclass[a4paper,11pt]{article}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage[usenames,dvipsnames]{color}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fancyhdr}
\usepackage{tabularx}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\titleformat{\section}{\vspace{-4pt}\scshape\raggedright\large}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]
${sharedMacros}
\begin{document}
\begin{center}
  \textbf{\Huge \scshape ${tex(basics.name)}}${nameGap(layout)} \\ \vspace{1pt}
  ${basics.headline ? String.raw`\small ${tex(basics.headline)} \\ \vspace{1pt}` : ""}
  \small ${contactParts(basics, layout?.links).join(" $|$ ")}
\end{center}

${renderSections(sections)}
\end{document}
`,
    layout,
  );
}
