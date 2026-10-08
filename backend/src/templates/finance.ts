import type { ResumeContent } from "../schemas/resume-content.js";
import { contactParts, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import {
  businessMacros,
  isCertifications,
  isSummary,
  leadsWithEducation,
  orderSections,
  renderBusinessSections,
  rupeeFallback,
} from "./shared-business.js";

// Corporate finance, audit and CA/CFA candidates: Palatino-style serif, navy small-caps headings
// with a hairline to the margin, credentials under the name and certifications right after the summary.
export function renderFinance(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  const early = leadsWithEducation(sections);
  const ordered = orderSections(sections, (s) =>
    isSummary(s) ? 0 : isCertifications(s) ? 1 : early && s.type === "education" ? 2 : 3,
  );
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
\setmainfont{texgyrepagella}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic]
${rupeeFallback}

\definecolor{navy}{HTML}{1F3A5F}
\definecolor{muted}{HTML}{4A5560}
\definecolor{hairline}{HTML}{9AA7B4}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\parindent}{0pt}
\newcommand{\ruledtitle}[1]{#1\enspace{\color{hairline}\leaders\hrule height \dimexpr0.55ex+0.25pt\relax depth -0.55ex\hfill}}
\titleformat{\section}{\vspace{-5pt}\color{navy}\large\scshape}{}{0em}{\ruledtitle}[\vspace{-6pt}]
\setlist{leftmargin=0.2in, itemsep=1pt, parsep=0pt, topsep=1pt, partopsep=0pt}
\renewcommand\labelitemi{{\color{navy}\small\textbullet}}
${businessMacros}
\newcommand{\linksep}{\enspace{\color{hairline}|}\enspace}
\newcommand{\expentry}[4]{\par\vspace{4pt}\ifnonempty{#2#4}{\textbf{#2}\hfill #4\par}\ifnonempty{#1#3}{{\color{navy}\itshape #1}\hfill{\color{muted}\small #3}\par}}
\newcommand{\eduentry}[5]{\par\vspace{4pt}\textbf{#1}\hfill #5\par\ifnonempty{#2#3#4}{{\itshape\joinwith{#2}{\enspace|\enspace}{#3}}\hfill{\color{muted}\small #4}\par}}
\newcommand{\projentry}[4]{\par\vspace{4pt}\textbf{#1}\ifnonempty{#2}{,\ \textit{#2}}\ifnonempty{#3}{\linksep #3}\hfill #4\par}
\newcommand{\listentry}[3]{\par\vspace{2pt}\textbf{#1}\ifnonempty{#2}{\linksep{\color{muted}#2}}\hfill #3\par}
\newcommand{\skillline}[2]{\par\vspace{2pt}\ifnonempty{#1}{\textbf{#1}: }#2\par}
\newcommand{\summarytext}[1]{\par\vspace{2pt}#1\par}
\newcommand{\linkline}[1]{\par\vspace{2pt}#1\par}

\begin{document}
{\color{navy}\fontsize{24pt}{28pt}\selectfont ${tex(basics.name)}}${nameGap(layout)}\par\vspace{3pt}
${basics.headline ? String.raw`{\large\itshape\color{navy} ${tex(basics.headline)}}\par\vspace{2pt}` : ""}
{\small\color{muted} ${contactParts(basics, layout?.links).join(String.raw`\linksep `)}}\par
\vspace{4pt}{\color{navy}\rule{\textwidth}{1.2pt}}\par

${renderBusinessSections(ordered)}
\end{document}
`,
    layout,
  );
}
