import type { ResumeSection } from "../schemas/resume-content.js";
import {
  compactList,
  dateRange,
  fitsOneLine,
  joinNonEmpty,
  tex,
  texRich,
  texUrl,
  gap,
  withGap,
  displayUrl,
} from "./latex.js";

// Section bodies shared by the templates. Each template defines these macros in its preamble:
// \resumeSubheading{title}{right}{subtitle}{right-sub}, \resumeProjectHeading{left}{right},
// \resumeItem{text}, \resumeSubHeadingListStart/End, \resumeItemListStart/End.

// `lead` lines go first without a bullet, like a project's tech list.
function bullets(items: { text: string }[], lead: string[] = []) {
  if (items.length === 0 && lead.length === 0) return "";
  return [
    "\\resumeItemListStart",
    ...lead.map((line) => `  \\item[] \\small{\\emph{${tex(line)}}}`),
    ...items.map((item) => `  \\resumeItem{${texRich(item.text)}}`),
    "\\resumeItemListEnd",
  ].join("\n");
}

function renderSectionBody(section: ResumeSection): string {
  switch (section.type) {
    case "experience":
      return section.entries
        .map((e) => {
          return [
            `\\resumeSubheading{${tex(e.role)}}{${dateRange(e.start, e.end)}}{${tex(e.organization)}}{${tex(e.location)}}`,
            bullets(e.bullets) + gap(e),
          ].join("\n");
        })
        .join("\n");
    case "education":
      return section.entries
        .map((e) => {
          const degree = joinNonEmpty([e.degree, e.field], ", ");
          const subtitle = joinNonEmpty([tex(degree), e.score ? `${tex(e.score)}` : undefined], " \\textbar{} ");
          return [
            `\\resumeSubheading{${tex(e.institution)}}{${tex(e.location)}}{${subtitle}}{${dateRange(e.start, e.end)}}`,
            bullets(e.bullets) + gap(e),
          ].join("\n");
        })
        .join("\n");
    case "projects":
      return section.entries
        .map((e) => {
          const name = e.url ? `\\href{${texUrl(e.url)}}{\\textbf{${tex(e.name)}}}` : `\\textbf{${tex(e.name)}}`;
          const techs = e.technologies.join(", ");
          const inline = fitsOneLine([e.name, techs, ...e.links.map((l) => l.label)], Boolean(e.start || e.end));
          const tech = techs && inline ? ` $|$ \\emph{${tex(techs)}}` : "";
          const links = e.links
            .map((link) => ` $|$ \\href{${texUrl(link.url)}}{\\underline{${tex(link.label)}}}`)
            .join("");
          return [
            `\\resumeProjectHeading{${name}${tech}${links}}{${dateRange(e.start, e.end)}}`,
            bullets(e.bullets, techs && !inline ? [techs] : []) + gap(e),
          ].join("\n");
        })
        .join("\n");
    case "list":
      return section.entries
        .map((e) => {
          const title = e.url ? `\\href{${texUrl(e.url)}}{\\textbf{${tex(e.title)}}}` : `\\textbf{${tex(e.title)}}`;
          const subtitle = e.subtitle ? ` -- ${tex(e.subtitle)}` : "";
          return [`\\resumeProjectHeading{${title}${subtitle}}{${tex(e.date)}}`, bullets(e.bullets) + gap(e)].join(
            "\n",
          );
        })
        .join("\n");
    case "skills":
    case "links":
    case "summary":
      return "";
  }
}

export function renderSections(sections: ResumeSection[]) {
  return sections
    .map((section) => {
      if (section.type === "skills") {
        const lines = section.groups
          .filter((group) => group.items.length > 0)
          .map((group) => `\\textbf{${tex(group.name)}}{: ${tex(group.items.join(", "))}}`)
          .join(" \\\\\n");
        return `\\section{${tex(section.title)}}\n\\begin{itemize}[leftmargin=0.15in, label={}]\n\\small{\\item{\n${lines}\n}}\n\\end{itemize}`;
      }
      if (section.type === "summary") {
        if (!section.text) return "";
        return `\\section{${tex(section.title)}}\n\\begin{itemize}[leftmargin=0.15in, label={}]\n\\small{\\item{${texRich(section.text)}}}\n\\end{itemize}`;
      }
      if (section.type === "links") {
        if (section.links.length === 0) return "";
        const links = section.links
          .map(
            (link) =>
              `\\mbox{${tex(link.label)}: \\href{${texUrl(link.url)}}{\\underline{${tex(displayUrl(link.url))}}}}`,
          )
          .join(", ");
        return `\\section{${tex(section.title)}}\n\\begin{itemize}[leftmargin=0.15in, label={}]\n\\small{\\item{${links}}}\n\\end{itemize}`;
      }
      if (section.entries.length === 0) return "";
      if (section.type === "list" && section.entries.every((e) => e.bullets.length === 0))
        return `\\section{${tex(section.title)}}\n${compactList(section.entries)}`;
      return `\\section{${tex(section.title)}}\n\\resumeSubHeadingListStart\n${renderSectionBody(section)}\n\\resumeSubHeadingListEnd`;
    })
    .map((rendered, i) => withGap(rendered, sections[i]!))
    .filter(Boolean)
    .join("\n\n");
}
