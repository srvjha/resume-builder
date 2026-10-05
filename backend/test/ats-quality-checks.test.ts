import { describe, expect, it, vi } from "vitest";
import { scoreResume } from "../src/modules/ats/scoring.js";

vi.mock("../src/lib/latex/compile.js", () => ({ compileTex: vi.fn() }));

const resume = (experience: string, extra = "") => `Aarav Sharma
Backend Engineer
aarav.sharma@example.com | +91 98765 43210 | Bengaluru, India
linkedin.com/in/aarav-sharma | github.com/aarav

Experience
${experience}

Projects
Ledger | github.com/aarav/ledger
• Implemented idempotent writes in TypeScript and PostgreSQL, handling 5k requests per second
• Deployed on AWS with Docker and GitHub Actions, used by 300 developers

Education
B.Tech in Computer Science, IIT Delhi | 2014 - 2018 | CGPA 8.7/10

Skills
Languages: Go, TypeScript, Python, SQL
${extra}`;

const roles = `Software Engineer, Razorpay | Jul 2022 - Present
• Built a reconciliation service in Go that matches 2M transactions a day
• Reduced p95 API latency from 480ms to 120ms with Redis caching
• Led 3 engineers to migrate 40 cron jobs to Kafka, cutting failures by 60%
Software Engineer, Flipkart | Jun 2018 - Dec 2020
• Designed REST APIs used by 12 internal teams
• Cut build times by 35% by caching Docker layers`;

const checkOf = (report: ReturnType<typeof scoreResume>, id: string) =>
  report.categories.flatMap((c) => c.checks).find((c) => c.id === id);

describe("date checks", () => {
  it("passes one format in order and flags mixed formats, seasons and reversed roles", () => {
    expect(checkOf(scoreResume({ text: resume(roles) }), "date-format")!.status).toBe("pass");
    const mixed = checkOf(scoreResume({ text: resume(roles.replace("Jun 2018", "06/2018")) }), "date-format")!;
    expect(mixed.status).toBe("warn");
    expect(mixed.detail).toContain("mixed formats");
    const season = checkOf(scoreResume({ text: resume(`${roles}\nIntern, Zoho | Summer 2017`) }), "date-format")!;
    expect(season.detail).toContain("Summer 2017");
    const reversed = scoreResume({ text: resume(roles.replace("Jun 2018 - Dec 2020", "Dec 2020 - Jun 2018")) });
    expect(checkOf(reversed, "date-format")!.status).toBe("fail");
  });

  it("flags gaps over six months between roles, but not for freshers", () => {
    const gap = checkOf(scoreResume({ text: resume(roles) }), "gaps")!;
    expect(gap.status).toBe("warn");
    expect(gap.detail).toContain("Dec 2020 and Jul 2022");
    const steady = roles.replace("Jun 2018 - Dec 2020", "Jun 2018 - Jun 2022");
    expect(checkOf(scoreResume({ text: resume(steady) }), "gaps")!.status).toBe("pass");
    const fresher = resume("Software Engineering Intern, Zoho | Jan 2022 - Jun 2022\n• Shipped a CSV import tool");
    expect(checkOf(scoreResume({ text: fresher }), "gaps")).toBeUndefined();
  });
});

describe("file checks", () => {
  const file = (name: string, sizeBytes = 120_000, pages = 1, hiddenLinks: string[] = []) => ({
    text: resume(roles),
    file: { name, sizeBytes, pages, hiddenLinks },
  });

  it("names, sizes, page counts and hidden links", () => {
    expect(checkOf(scoreResume(file("Aarav-Sharma-Resume.pdf")), "file-name")!.status).toBe("pass");
    expect(checkOf(scoreResume(file("resume_final_v3 (2).pdf")), "file-name")!.status).toBe("warn");
    expect(checkOf(scoreResume(file("CV.pdf")), "file-name")!.status).toBe("warn");
    expect(checkOf(scoreResume(file("a.pdf", 1_500_000)), "file-size")!.status).toBe("warn");
    expect(checkOf(scoreResume(file("a.pdf", 3_000_000)), "file-size")!.status).toBe("fail");
    expect(checkOf(scoreResume(file("a.pdf", 100_000, 4)), "word-count")!.status).toBe("fail");
    expect(checkOf(scoreResume(file("a.pdf", 100_000, 4)), "word-count")!.detail).toMatch(/^4 pages/);
    const links = checkOf(scoreResume(file("a.pdf", 100_000, 1, ["https://aarav.dev"])), "hidden-links")!;
    expect(links.status).toBe("warn");
    expect(links.lines).toEqual([{ text: "https://aarav.dev" }]);
  });

  it("finds text too small to see or outside the page", () => {
    const page = { width: 612, height: 792 };
    const item = (text: string, height: number, x = 72) => ({ text, x, y: 100, width: 50, height, page: 1 });
    const pdf = (items: ReturnType<typeof item>[]) => scoreResume({ text: resume(roles), pdf: { items, page } });
    expect(checkOf(pdf([item("Aarav Sharma", 18)]), "hidden-text")!.status).toBe("pass");
    const tiny = checkOf(pdf([item("Aarav Sharma", 18), item("Kubernetes Terraform", 1)]), "hidden-text")!;
    expect(tiny.status).toBe("fail");
    expect(tiny.lines).toEqual([{ text: "Kubernetes Terraform" }]);
    expect(checkOf(pdf([item("hidden", 10, 900)]), "hidden-text")!.status).toBe("fail");
  });
});

describe("content checks", () => {
  it("flags informal emails without flagging names that contain those letters", () => {
    expect(checkOf(scoreResume({ text: resume(roles) }), "email-address")!.status).toBe("pass");
    const informal = resume(roles).replace("aarav.sharma@", "coolaarav@");
    expect(checkOf(scoreResume({ text: informal }), "email-address")!.status).toBe("warn");
    const kingshuk = resume(roles).replace("aarav.sharma@", "kingshuk.das@");
    expect(checkOf(scoreResume({ text: kingshuk }), "email-address")!.status).toBe("pass");
  });

  it("expects education first for freshers and experience first after that", () => {
    expect(checkOf(scoreResume({ text: resume(roles) }), "section-order")!.status).toBe("pass");
    const fresher = `Riya Patel\nriya@example.com\n\nExperience\nIntern, Zoho | Jan 2024 - Jun 2024\n• Built a dashboard used by 20 people\n\nEducation\nB.Com, Delhi University | 2021 - 2024\n\nSkills\nExcel, Tally`;
    expect(checkOf(scoreResume({ text: fresher }), "section-order")!.status).toBe("pass");
  });

  it("flags a verb that starts many bullets and a skill repeated too often, with the lines", () => {
    const same = roles.replace(/• (Built|Reduced|Led|Designed|Cut)/g, "• Developed");
    const openers = checkOf(scoreResume({ text: resume(same) }), "repeated-openers")!;
    expect(openers.status).toBe("warn");
    expect(openers.detail).toContain('"Developed" starts 5 bullets');
    expect(openers.lines![0]!.highlight).toBe("Developed");
    expect(checkOf(scoreResume({ text: resume(roles) }), "repeated-openers")!.status).toBe("pass");

    const stuffed = resume(roles, "Tools: Docker, Docker, Docker, Docker, Docker, Docker, Docker, Docker");
    expect(checkOf(scoreResume({ text: stuffed }), "keyword-stuffing")!.detail).toMatch(/Docker appears \d+ times/);
    expect(checkOf(scoreResume({ text: resume(roles) }), "keyword-stuffing")!.status).toBe("pass");
  });

  it("shows the bullets behind a failing check, and none for a passing one", () => {
    const weak = roles.replace(/• (Built|Reduced|Led|Designed|Cut)/g, "• Responsible for $1");
    const verbs = checkOf(scoreResume({ text: resume(weak) }), "action-verbs")!;
    expect(verbs.lines?.[0]).toEqual({ text: expect.stringContaining("Responsible for"), highlight: "Responsible" });
    expect(checkOf(scoreResume({ text: resume(roles) }), "email")!.lines).toBeUndefined();
  });
});

describe("job checks", () => {
  const job = `Backend Engineer

Requirements:
- 3+ years with Go and PostgreSQL
- Experience with machine learning pipelines
`;

  it("wants the job's title in the headline when it's elsewhere on the resume", () => {
    expect(checkOf(scoreResume({ text: resume(roles), jobText: job }), "title-headline")!.status).toBe("pass");
    const noHeadline = resume(roles).replace("Backend Engineer\n", "Payments and data\n");
    const withRole = noHeadline.replace("Software Engineer, Razorpay", "Backend Engineer, Razorpay");
    expect(checkOf(scoreResume({ text: withRole, jobText: job }), "title-headline")!.status).toBe("warn");
  });

  it("asks to write a skill both ways when the resume uses one form only", () => {
    const ml = resume(roles, "ML: PyTorch");
    const acronyms = checkOf(scoreResume({ text: ml, jobText: job }), "acronyms")!;
    expect(acronyms.status).toBe("warn");
    expect(acronyms.detail.toLowerCase()).toContain("machine learning (ml)");
    const both = resume(roles, "Machine Learning (ML): PyTorch");
    expect(checkOf(scoreResume({ text: both, jobText: job }), "acronyms")!.status).toBe("pass");
  });
});
