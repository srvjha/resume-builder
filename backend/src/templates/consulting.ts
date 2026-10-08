import type { ResumeContent } from "../schemas/resume-content.js";
import { contactParts, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import {
  businessMacros,
  isSummary,
  leadsWithEducation,
  orderSections,
  renderBusinessSections,
} from "./shared-business.js";

// Clean one-page consulting layout: humanist sans, letterspaced headings under a heavy rule, firm and
// dates on one line with the role below, square bullets for impact-first results. Education leads early on.
export function renderConsulting(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  const early = leadsWithEducation(sections);
  const ordered = orderSections(sections, (s) => (isSummary(s) ? 0 : early && s.type === "education" ? 1 : 2));
  return applyLayout(
    String.raw`\documentclass[a4paper,11pt]{article}
\usepackage[top=0.5in, bottom=0.5in, left=0.6in, right=0.6in]{geometry}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
\setmainfont{SourceSansPro}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-Semibold, ItalicFont=*-RegularIt, BoldItalicFont=*-SemiboldIt]

\definecolor{ink}{HTML}{1A1A1A}
\definecolor{muted}{HTML}{5B6168}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\parindent}{0pt}
\color{ink}
\titleformat{\section}{\vspace{-6pt}{\titlerule[0.9pt]}\vspace{2pt}\bfseries\small\addfontfeatures{LetterSpace=10}}{}{0em}{\MakeUppercase}[\vspace{-6pt}]
\setlist{leftmargin=0.18in, itemsep=1pt, parsep=0pt, topsep=1pt, partopsep=0pt}
\renewcommand\labelitemi{\raisebox{0.3ex}{\rule{3.2pt}{3.2pt}}}
${businessMacros}
\newcommand{\linksep}{\enspace{\color{muted}/}\enspace}
\newcommand{\expentry}[4]{\par\vspace{4pt}\ifnonempty{#1#3#4}{\textbf{#1}\ifnonempty{#3}{\enspace{\color{muted}#3}}\hfill #4\par}\ifnonempty{#2}{\textit{#2}\par}}
\newcommand{\eduentry}[5]{\par\vspace{4pt}\textbf{#1}\ifnonempty{#4}{\enspace{\color{muted}#4}}\hfill #5\par\ifnonempty{#2#3}{\joinwith{\textit{#2}}{; }{#3}\par}}
\newcommand{\projentry}[4]{\par\vspace{4pt}\textbf{#1}\ifnonempty{#2}{\enspace{\color{muted}#2}}\ifnonempty{#3}{\linksep #3}\hfill #4\par}
\newcommand{\listentry}[3]{\par\vspace{2pt}\textbf{#1}\ifnonempty{#2}{: #2}\hfill #3\par}
\newcommand{\skillline}[2]{\par\vspace{2pt}\ifnonempty{#1}{\textbf{#1}: }#2\par}
\newcommand{\summarytext}[1]{\par\vspace{2pt}#1\par}
\newcommand{\linkline}[1]{\par\vspace{2pt}#1\par}

\begin{document}
{\centering
  {\fontsize{20pt}{24pt}\selectfont\bfseries\addfontfeatures{LetterSpace=12}\MakeUppercase{${tex(basics.name)}}}${nameGap(layout)}\par\vspace{4pt}
  ${basics.headline ? String.raw`{${tex(basics.headline)}}\par\vspace{1pt}` : ""}
  {\small\color{muted} ${contactParts(basics, layout?.links).join(String.raw`\linksep `)}}\par
}
\vspace{2pt}

${renderBusinessSections(ordered)}
\end{document}
`,
    layout,
  );
}
