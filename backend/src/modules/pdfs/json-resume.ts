import type { ResumeContent } from "../../schemas/resume-content.js";

// Maps our content to the JSON Resume schema (jsonresume.org) for portability.
export function toJsonResume(content: ResumeContent) {
  const out: Record<string, unknown> = {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: content.basics.name,
      label: content.basics.headline,
      email: content.basics.email,
      phone: content.basics.phone,
      location: content.basics.location ? { address: content.basics.location } : undefined,
      profiles: content.basics.links.map((link) => ({ network: link.label, url: link.url })),
    },
  };
  const bullets = (items: { text: string; hidden: boolean }[]) =>
    items.filter((b) => !b.hidden).map((b) => b.text.replace(/\*\*/g, ""));
  // A resume can have several sections of one type ("Experience" and "Internships"), so each one appends.
  const add = (key: string, items: unknown[]) => (out[key] = [...((out[key] as unknown[]) ?? []), ...items]);

  for (const section of content.sections) {
    if (section.hidden) continue;
    switch (section.type) {
      case "experience":
        add(
          "work",
          section.entries
            .filter((e) => !e.hidden)
            .map((e) => ({
              name: e.organization,
              position: e.role,
              location: e.location,
              startDate: e.start,
              endDate: e.end === "present" ? undefined : e.end,
              highlights: bullets(e.bullets),
            })),
        );
        break;
      case "education":
        add(
          "education",
          section.entries
            .filter((e) => !e.hidden)
            .map((e) => ({
              institution: e.institution,
              studyType: e.degree,
              area: e.field,
              score: e.score,
              startDate: e.start,
              endDate: e.end === "present" ? undefined : e.end,
            })),
        );
        break;
      case "projects":
        add(
          "projects",
          section.entries
            .filter((e) => !e.hidden)
            .map((e) => ({
              name: e.name,
              url: e.url ?? e.links[0]?.url,
              keywords: e.technologies,
              startDate: e.start,
              endDate: e.end === "present" ? undefined : e.end,
              highlights: bullets(e.bullets),
            })),
        );
        break;
      case "skills":
        add(
          "skills",
          section.groups.map((group) => ({ name: group.name, keywords: group.items })),
        );
        break;
      case "list":
        add(
          "awards",
          section.entries.filter((e) => !e.hidden).map((e) => ({ title: e.title, summary: e.subtitle, date: e.date })),
        );
        break;
      case "summary":
        (out.basics as { summary?: string | undefined }).summary = section.text || undefined;
        break;
      case "links":
        (out.basics as { profiles: unknown[] }).profiles.push(
          ...section.links.map((link) => ({ network: link.label, url: link.url })),
        );
        break;
    }
  }
  return JSON.parse(JSON.stringify(out));
}
