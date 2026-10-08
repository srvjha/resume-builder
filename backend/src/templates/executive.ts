import type { ResumeContent, ResumeSection } from "../schemas/resume-content.js";
import { contactParts, tex, visibleContent } from "./latex.js";
import { applyLayout, nameGap, type ResumeLayout } from "./layout.js";
import {
  businessMacros,
  isBoard,
  isCertifications,
  isSummary,
  orderSections,
  renderBusinessSections,
} from "./shared-business.js";

// Summary and competencies first, then career history, board roles and education.
const rank = (s: ResumeSection) => {
  if (isSummary(s)) return 0;
  if (s.type === "skills") return 1;
  if (s.type === "experience") return 2;
  if (isBoard(s)) return 3;
  if (s.type === "education") return 4;
  if (isCertifications(s)) return 5;
  return 6;
};

// Senior leadership: Garamond, a centered small-caps name over a double rule, headings flanked by
// rules, a keyword block of core competencies and roles grouped under each company.
export function renderExecutive(input: ResumeContent, layout?: ResumeLayout) {
  const { basics, sections } = visibleContent(input);
  return applyLayout(
    String.raw`\documentclass[a4paper,11pt]{article}
\usepackage[top=0.55in, bottom=0.55in, left=0.7in, right=0.7in]{geometry}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}
\usepackage{accsupp}
\usepackage{fontspec}
\setmainfont{EBGaramond}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-SemiBold, ItalicFont=*-Italic, BoldItalicFont=*-SemiBoldItalic]

\definecolor{accent}{HTML}{6B1D2A}
\definecolor{ink}{HTML}{1F1F1F}
\definecolor{muted}{HTML}{5E5A57}
\pagestyle{empty}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\parindent}{0pt}
\color{ink}
\newcommand{\flankrule}{{\color{accent}\leaders\hrule height \dimexpr0.5ex+0.3pt\relax depth -0.5ex\hfill}}
\newcommand{\flanked}[1]{\flankrule\enspace#1\enspace\flankrule}
\titleformat{\section}{\vspace{-4pt}\large\scshape\addfontfeatures{LetterSpace=4}}{}{0em}{\flanked}[\vspace{-4pt}]
\setlist{leftmargin=0.2in, itemsep=1pt, parsep=0pt, topsep=2pt, partopsep=0pt}
\renewcommand\labelitemi{{\color{accent}\small\textbullet}}
${businessMacros}
\newcommand{\linksep}{\enspace{\color{accent}\textbullet}\enspace}
\newcommand{\compsep}{\discretionary{}{}{\hbox{\enspace{\color{accent}\textbullet}\enspace}}}
\newcommand{\competencies}[2]{\par\vspace{3pt}{\centering\ifnonempty{#1}{\textbf{#1}:\enspace}#2\par}}
\newcommand{\expentry}[4]{\par\ifnonempty{#1#3}{\vspace{6pt}{\large\bfseries #1}\hfill{\color{muted}\itshape #3}\par}\vspace{1pt}\ifnonempty{#2#4}{{\color{accent}\itshape #2}\hfill #4\par}}
\newcommand{\eduentry}[5]{\par\vspace{4pt}\textbf{#1}\hfill #5\par\ifnonempty{#2#3#4}{\joinwith{\textit{#2}}{, }{#3}\hfill{\color{muted}\itshape #4}\par}}
\newcommand{\projentry}[4]{\par\vspace{4pt}\textbf{#1}\ifnonempty{#2}{,\ \textit{#2}}\ifnonempty{#3}{\linksep #3}\hfill #4\par}
\newcommand{\listentry}[3]{\par\vspace{3pt}\textbf{#1}\ifnonempty{#2}{,\ \textit{#2}}\hfill #3\par}
\newcommand{\skillline}[2]{\par\vspace{2pt}\ifnonempty{#1}{\textbf{#1}: }#2\par}
\newcommand{\summarytext}[1]{\par\vspace{3pt}#1\par}
\newcommand{\linkline}[1]{\par\vspace{3pt}#1\par}

\begin{document}
{\centering
  {\fontsize{26pt}{30pt}\selectfont\scshape\addfontfeatures{LetterSpace=6}${tex(basics.name)}}${nameGap(layout)}\par\vspace{4pt}
  ${basics.headline ? String.raw`{\large\itshape\color{accent} ${tex(basics.headline)}}\par\vspace{3pt}` : ""}
  {\small ${contactParts(basics, layout?.links).join(String.raw`\linksep `)}}\par
}
\vspace{5pt}{\color{accent}\hrule height 1.4pt\vspace{1.5pt}\hrule height 0.4pt}
\vspace{2pt}

${renderBusinessSections(orderSections(sections, rank), { competencies: true, groupRoles: true })}
\end{document}
`,
    layout,
  );
}
