import type { ResumeContent } from "../schemas/resume-content.js";
import { contactParts, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import {
  businessMacros,
  isSummary,
  leadsWithEducation,
  orderSections,
  renderBusinessSections,
  rupeeFallback,
} from "./shared-business.js";

// The dense one-page Wall Street layout: Times-style serif, firm names in bold with locations and
// dates flush right, uppercase ruled headings and tight spacing. Education leads for students.
export function renderBanking(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  const early = leadsWithEducation(sections);
  const ordered = orderSections(sections, (s) => (isSummary(s) ? 0 : early && s.type === "education" ? 1 : 2));
  return applyLayout(
    String.raw`\documentclass[a4paper,10pt]{article}
\usepackage[top=0.45in, bottom=0.45in, left=0.55in, right=0.55in]{geometry}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
\setmainfont{texgyretermes}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic]
${rupeeFallback}

\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\parindent}{0pt}
\titleformat{\section}{\vspace{-5pt}\bfseries\small}{}{0em}{\MakeUppercase}[\vspace{-1pt}{\titlerule[0.6pt]}\vspace{-5pt}]
\setlist{leftmargin=0.17in, itemsep=0pt, parsep=0pt, topsep=0pt, partopsep=0pt}
\renewcommand\labelitemi{\raisebox{0.1ex}{\scriptsize\textbullet}}
${businessMacros}
\newcommand{\linksep}{\enspace|\enspace}
\newcommand{\expentry}[4]{\par\vspace{3pt}\ifnonempty{#1#3}{\textbf{#1}\hfill #3\par}\ifnonempty{#2#4}{\textit{#2}\hfill #4\par}}
\newcommand{\eduentry}[5]{\par\vspace{3pt}\textbf{#1}\hfill #4\par\ifnonempty{#2#3#5}{\joinwith{#2}{; }{#3}\hfill #5\par}}
\newcommand{\projentry}[4]{\par\vspace{3pt}\textbf{#1}\ifnonempty{#2}{\enspace\textit{#2}}\ifnonempty{#3}{\linksep #3}\hfill #4\par}
\newcommand{\listentry}[3]{\par\vspace{1pt}\textbf{#1}\ifnonempty{#2}{, #2}\hfill #3\par}
\newcommand{\skillline}[2]{\par\vspace{1pt}\ifnonempty{#1}{\textbf{#1}: }#2\par}
\newcommand{\summarytext}[1]{\par\vspace{2pt}#1\par}
\newcommand{\linkline}[1]{\par\vspace{2pt}#1\par}

\begin{document}
{\centering
  {\LARGE\bfseries ${tex(basics.name)}}${nameGap(layout)}\par\vspace{2pt}
  ${basics.headline ? String.raw`{\small ${tex(basics.headline)}}\par\vspace{1pt}` : ""}
  {\small ${contactParts(basics, layout?.links).join(String.raw`\linksep `)}}\par
}

${renderBusinessSections(ordered)}
\end{document}
`,
    layout,
  );
}
