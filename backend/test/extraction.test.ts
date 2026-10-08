import { describe, expect, it } from "vitest";
import { type Extraction, normalizeExtraction } from "../src/modules/imports/extraction.js";

const entry = (fields: Partial<Extraction["sections"][number]["entries"][number]>) => ({
  organization: null,
  role: null,
  institution: null,
  degree: null,
  field: null,
  score: null,
  name: null,
  title: null,
  subtitle: null,
  url: null,
  location: null,
  start: null,
  end: null,
  date: null,
  technologies: [],
  links: [],
  bullets: [],
  ...fields,
});

describe("normalizeExtraction", () => {
  it("cleans model output into valid resume content", () => {
    const content = normalizeExtraction({
      basics: {
        name: " Saurav Jha ",
        headline: "",
        email: "not-an-email",
        phone: "+91 99999 00000",
        location: null,
        links: [
          { label: "Github", url: "github.com/srvjha" },
          { label: "Bad", url: "ht tp://nope" },
        ],
      },
      sections: [
        {
          type: "experience",
          title: "Experience",
          groups: [],
          links: [],
          entries: [
            entry({
              organization: "Bug0",
              role: "SWE",
              start: "Nov 2025",
              end: "Present",
              bullets: ["Built **agents**", "  "],
            }),
          ],
        },
        {
          type: "skills",
          title: "Skills",
          entries: [],
          links: [],
          groups: [
            { name: "Languages", items: ["TS", ""] },
            { name: "Empty", items: [] },
          ],
        },
      ],
    });

    expect(content.basics).toEqual({
      name: "Saurav Jha",
      phone: "+91 99999 00000",
      links: [{ label: "Github", url: "https://github.com/srvjha" }],
    });
    const [experience, skills] = content.sections;
    if (experience?.type !== "experience" || skills?.type !== "skills") throw new Error("unexpected");
    expect(experience.entries[0]).toMatchObject({
      organization: "Bug0",
      end: "present",
      bullets: [{ text: "Built **agents**" }],
    });
    expect(experience.entries[0]!.start).toBeUndefined();
    expect(skills.groups).toHaveLength(1);
    expect(skills.groups[0]!.items).toEqual(["TS"]);
    expect(new Set([experience.id, skills.id]).size).toBe(2);
  });
});

describe("normalizeExtraction limits", () => {
  it("moves a paragraph headline into a Summary section and cuts over-long fields", () => {
    const paragraph = "Analyst with five years in equity research. ".repeat(10);
    const content = normalizeExtraction({
      basics: { name: "A", headline: paragraph, email: null, phone: null, location: null, links: [] },
      sections: [
        {
          type: "skills",
          title: "Skills",
          text: null,
          entries: [],
          links: [],
          groups: [{ name: "Tools", items: ["x".repeat(100), ...Array.from({ length: 50 }, (_, i) => `s${i}`)] }],
        },
      ],
    });
    expect(content.basics.headline).toBeUndefined();
    const [summary, skills] = content.sections;
    expect(summary?.type === "summary" && summary.text).toBe(paragraph.trim());
    expect(skills?.type === "skills" && skills.groups[0]!.items).toHaveLength(40);
    expect(skills?.type === "skills" && skills.groups[0]!.items[0]).toHaveLength(60);
  });
});

describe("normalizeExtraction bullets", () => {
  it("drops the source's bullet symbols but keeps bold and leading numbers", () => {
    const content = normalizeExtraction({
      basics: { name: "A", headline: null, email: null, phone: null, location: null, links: [] },
      sections: [
        {
          type: "experience",
          title: "Experience",
          text: null,
          groups: [],
          links: [],
          entries: [
            entry({
              organization: "Ajar",
              bullets: ["• Fixed a leak", "- Audited auth", "• • Built a hub", "**Cut** builds", "-5% cost", "•"],
            }),
          ],
        },
      ],
    });
    const experience = content.sections[0];
    expect(experience?.type === "experience" && experience.entries[0]!.bullets.map((b) => b.text)).toEqual([
      "Fixed a leak",
      "Audited auth",
      "Built a hub",
      "**Cut** builds",
      "-5% cost",
    ]);
  });
});

describe("normalizeExtraction list items", () => {
  it("turns untitled achievement bullets into their own items", () => {
    const content = normalizeExtraction({
      basics: { name: "A", headline: null, email: null, phone: null, location: null, links: [] },
      sections: [
        {
          type: "list",
          title: "Achievements & Open Source",
          text: null,
          groups: [],
          links: [],
          entries: [
            entry({ bullets: ["• Codeforces rated 1490", "Ranked 2495 in Meta Hacker Cup"] }),
            entry({ title: "CopilotKit", subtitle: "Fixed markdown styles", url: "github.com/CopilotKit/pull/1" }),
          ],
        },
      ],
    });
    const list = content.sections[0];
    expect(list?.type === "list" && list.entries.map((e) => [e.title, e.subtitle, e.url])).toEqual([
      ["Codeforces rated 1490", undefined, undefined],
      ["Ranked 2495 in Meta Hacker Cup", undefined, undefined],
      ["CopilotKit", "Fixed markdown styles", "https://github.com/CopilotKit/pull/1"],
    ]);
  });
});

describe("normalizeExtraction link labels", () => {
  it("names a link by its site when the label is a URL", () => {
    const content = normalizeExtraction({
      basics: {
        name: "A",
        headline: null,
        email: null,
        phone: null,
        location: null,
        links: [
          { label: "https://x.com/aarav", url: "https://x.com/aarav" },
          { label: "linkedin.com/in/aarav", url: "linkedin.com/in/aarav" },
          { label: "aarav.dev", url: "https://aarav.dev" },
          { label: "My Blog", url: "https://blog.aarav.dev" },
        ],
      },
      sections: [],
    });
    expect(content.basics.links.map((l) => l.label)).toEqual(["X", "LinkedIn", "Portfolio", "My Blog"]);
  });
});

describe("normalizeExtraction cleanup", () => {
  const base = { name: "A", headline: null, phone: null, location: null, links: [] };
  it("keeps misplaced text, single dates, clean words and site names", () => {
    const content = normalizeExtraction({
      basics: {
        ...base,
        email: "mailto:a@example.com",
        links: [{ label: "aarav.github.io", url: "https://aarav.github.io" }],
      },
      sections: [
        {
          type: "projects",
          title: "Projects",
          text: null,
          groups: [],
          links: [],
          entries: [
            entry({ name: "CampusBus", subtitle: "Live bus tracking for 2,000 students", bullets: ["Built it"] }),
          ],
        },
        {
          type: "education",
          title: "Education",
          text: null,
          groups: [],
          links: [],
          entries: [entry({ institution: "DPS", start: "2019", end: "2019" })],
        },
        {
          type: "list",
          title: "Certifications",
          text: null,
          groups: [],
          links: [],
          entries: [entry({ title: "AWS Certifi￾cate", subtitle: "Verify", date: "2023" })],
        },
      ],
    });
    expect(content.basics.email).toBe("a@example.com");
    expect(content.basics.links[0]?.label).toBe("Portfolio");
    const [projects, education, list] = content.sections;
    expect(projects?.type === "projects" && projects.entries[0]!.bullets.map((b) => b.text)).toEqual([
      "Live bus tracking for 2,000 students",
      "Built it",
    ]);
    expect(education?.type === "education" && [education.entries[0]!.start, education.entries[0]!.end]).toEqual([
      undefined,
      "2019",
    ]);
    expect(list?.type === "list" && [list.entries[0]!.title, list.entries[0]!.subtitle]).toEqual([
      "AWS Certificate",
      undefined,
    ]);
  });
});

describe("normalizeExtraction tech stacks", () => {
  it("moves a Tech Stack line into technologies and drops the colon from skill groups", () => {
    const content = normalizeExtraction({
      basics: { name: "A", headline: null, email: null, phone: null, location: null, links: [] },
      sections: [
        {
          type: "projects",
          title: "Projects",
          text: null,
          groups: [],
          links: [],
          entries: [
            entry({ name: "Abhyas", bullets: ["Tech Stack: React.js, AWS (EC2, Amplify, RDS), Qdrant", "Built it"] }),
          ],
        },
        {
          type: "skills",
          title: "Skills",
          text: null,
          entries: [],
          links: [],
          groups: [{ name: "Frontend:", items: ["Next.js"] }],
        },
      ],
    });
    const [projects, skills] = content.sections;
    expect(projects?.type === "projects" && projects.entries[0]!.technologies).toEqual([
      "React.js",
      "AWS (EC2, Amplify, RDS)",
      "Qdrant",
    ]);
    expect(projects?.type === "projects" && projects.entries[0]!.bullets.map((b) => b.text)).toEqual(["Built it"]);
    expect(skills?.type === "skills" && skills.groups[0]!.name).toBe("Frontend");
  });
});

describe("normalizeExtraction project links", () => {
  it("shows the project url as a labelled link when it isn't one already", () => {
    const content = normalizeExtraction({
      basics: { name: "A", headline: null, email: null, phone: null, location: null, links: [] },
      sections: [
        {
          type: "projects",
          title: "Projects",
          text: null,
          groups: [],
          links: [],
          entries: [
            entry({
              name: "Abhyas",
              url: "https://github.com/karan/abhyas",
              links: [{ label: "Live", url: "https://abhyas.app" }],
            }),
          ],
        },
      ],
    });
    const projects = content.sections[0];
    expect(projects?.type === "projects" && projects.entries[0]!.links.map((l) => l.label)).toEqual(["GitHub", "Live"]);
  });
});

describe("normalizeExtraction repeats", () => {
  it("drops the company from the role and a project line that only repeats its stack and links", () => {
    const content = normalizeExtraction({
      basics: { name: "A", headline: null, email: null, phone: null, location: null, links: [] },
      sections: [
        {
          type: "experience",
          title: "Experience",
          text: null,
          groups: [],
          links: [],
          entries: [
            entry({ organization: "Carbharatics.com", role: "Full Stack Developer — Carbharatics.com" }),
            entry({ organization: "Unicapp", role: "Backend Developer at Unicapp" }),
            entry({ organization: "Go", role: "Go Developer" }),
          ],
        },
        {
          type: "projects",
          title: "Projects",
          text: null,
          groups: [],
          links: [],
          entries: [
            entry({
              name: "Crewly",
              subtitle: "React.js, PostgreSQL, **Prisma** | Live | Code",
              technologies: ["React.js", "PostgreSQL", "Prisma"],
              bullets: ["Built a multi-tenant React.js, PostgreSQL app"],
            }),
          ],
        },
      ],
    });
    const [experience, projects] = content.sections;
    expect(experience?.type === "experience" && experience.entries.map((e) => e.role)).toEqual([
      "Full Stack Developer",
      "Backend Developer",
      "Go Developer",
    ]);
    expect(projects?.type === "projects" && projects.entries[0]!.bullets.map((b) => b.text)).toEqual([
      "Built a multi-tenant React.js, PostgreSQL app",
    ]);
  });
});

describe("normalizeExtraction taglines and stacks", () => {
  const section = (type: "projects" | "experience", fields: Parameters<typeof entry>[0]) => ({
    type,
    title: type,
    text: null,
    groups: [],
    links: [],
    entries: [entry(fields)],
  });
  const first = (content: ReturnType<typeof normalizeExtraction>) => {
    const s = content.sections[0]!;
    if (!("entries" in s)) throw new Error("no entries");
    return s.entries[0]!;
  };

  it("moves a bare tech list into technologies and hides the project's tagline", () => {
    const project = first(
      normalizeExtraction({
        basics: { name: "A", headline: null, email: null, phone: null, location: null, links: [] },
        sections: [
          section("projects", {
            name: "Yugati",
            bullets: [
              "Agentic Email & Calendar Assistant",
              "OpenAI Agents SDK, GPT-4.1, Next.js, TypeScript, Redis",
              "Built and deployed a production agentic AI assistant, streaming responses via SSE.",
            ],
          }),
        ],
      }),
    );
    expect(project).toMatchObject({ technologies: ["OpenAI Agents SDK", "GPT-4.1", "Next.js", "TypeScript", "Redis"] });
    expect(project.bullets.map((b) => [b.text, b.hidden])).toEqual([
      ["Agentic Email & Calendar Assistant", true],
      ["Built and deployed a production agentic AI assistant, streaming responses via SSE.", false],
    ]);
  });

  it("hides a sub-heading under a job but keeps short real bullets", () => {
    const job = first(
      normalizeExtraction({
        basics: { name: "A", headline: null, email: null, phone: null, location: null, links: [] },
        sections: [
          section("experience", {
            organization: "Bug0",
            role: "Software Engineer",
            location: "Hybrid, India",
            subtitle: "Hybrid, India",
            bullets: ["AI-Driven QA Automation", "Led a team of 6 engineers", "Cut test flakiness by 40%"],
          }),
        ],
      }),
    );
    // The location the model also copied into subtitle doesn't come back as a bullet.
    expect(job.bullets.map((b) => b.hidden)).toEqual([true, false, false]);
  });
});
