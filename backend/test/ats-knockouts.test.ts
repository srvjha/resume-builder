import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findKnockouts, mergedMonths } from "../src/modules/ats/knockouts.js";
import { resumeContentSchema } from "../src/schemas/resume-content.js";

const resumeText = `Aarav Sharma
Backend Engineer
aarav@example.com | Bengaluru, India

Experience
Software Engineer, Razorpay | Jul 2022 - Present
Software Engineering Intern, Zoho | Jan 2022 - Jun 2022

Education
B.Tech in Computer Science, IIT Delhi | 2018 - 2022
`;

const content = resumeContentSchema.parse({
  basics: { name: "Aarav Sharma", location: "Bengaluru, India" },
  sections: [
    {
      id: "exp",
      type: "experience",
      title: "Experience",
      entries: [
        { id: "a", organization: "Razorpay", role: "Software Engineer", start: "2024-01", end: "present" },
        { id: "b", organization: "Zoho", role: "Software Engineer", start: "2023-01", end: "2024-06" },
        { id: "c", organization: "Swiggy", role: "SDE Intern", start: "2022-01", end: "2022-12" },
      ],
    },
    {
      id: "edu",
      type: "education",
      title: "Education",
      entries: [{ id: "d", institution: "IIT Delhi", degree: "B.Tech", field: "Computer Science", end: "2022" }],
    },
  ],
});

const byId = (list: ReturnType<typeof findKnockouts>, id: string) => list.find((k) => k.id === id);

beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-10-15")));
afterEach(() => vi.useRealTimers());

describe("experience computation", () => {
  it("counts overlapping ranges once", () => {
    expect(
      mergedMonths([
        [0, 12],
        [6, 18],
        [30, 36],
        [32, 34],
      ]),
    ).toBe(24);
  });

  it("merges overlapping roles, treats present as today and skips internships", () => {
    const [k] = findKnockouts("Requirements\n- Minimum 3 years of experience in backend development.", {
      text: "",
      content,
    });
    // Jan 2023 to Oct 2026 = 46 months.
    expect(k).toMatchObject({ id: "experience-years", status: "met", required: true });
    expect(k?.evidence).toContain("About 3.8 years");
  });

  it("falls back to date ranges in the text", () => {
    const [k] = findKnockouts("At least five years of experience with Go.", { text: resumeText });
    expect(k).toMatchObject({ status: "not-met" });
    expect(k?.evidence).toContain("About 4.3 years");
  });
});

describe("findKnockouts", () => {
  it("reads an Indian backend role", () => {
    const job = `About us
We have 15 years in business and 5 years of growth.

Requirements
- 3+ years of experience building backend services
- B.Tech/BE in Computer Science
- Location: Bengaluru (on-site)
- Immediate joiners preferred`;
    const list = findKnockouts(job, { text: resumeText });
    expect(list.map((k) => k.id)).toEqual(["experience-years", "degree", "location", "notice-period"]);
    expect(byId(list, "experience-years")).toMatchObject({ status: "met" });
    expect(byId(list, "degree")).toMatchObject({ status: "met", required: true });
    expect(byId(list, "location")).toMatchObject({ status: "met" });
    expect(byId(list, "notice-period")).toMatchObject({ status: "not-on-resume", required: false });
  });

  it("is honest about US work authorization", () => {
    const job =
      "Remote (US only). You must be authorized to work in the US. We do not sponsor visas; no sponsorship available.";
    const list = findKnockouts(job, { text: resumeText, content });
    expect(byId(list, "work-authorization")).toMatchObject({ status: "not-on-resume", required: true });
    expect(byId(list, "work-authorization")?.advice).toContain("does not sponsor");
    expect(byId(list, "location")).toMatchObject({ label: "Remote, country restricted", status: "not-met" });
  });

  it("reads an investment banking analyst role", () => {
    const job = `Qualifications
MBA from a tier-1 institute is mandatory.
CFA Level 1 a plus.`;
    const list = findKnockouts(job, { text: resumeText, content });
    expect(byId(list, "degree")).toMatchObject({ status: "not-met", required: true });
    expect(byId(list, "certification")).toMatchObject({ label: "CFA", status: "not-met", required: false });
    expect(list.at(-1)?.required).toBe(false);
  });

  it("reads a fresher campus role", () => {
    const student = resumeContentSchema.parse({
      basics: { name: "Priya", location: "Pune" },
      sections: [
        {
          id: "edu",
          type: "education",
          title: "Education",
          entries: [{ id: "e", institution: "COEP", degree: "B.E.", field: "Information Technology", end: "2026" }],
        },
      ],
    });
    const job = "Eligibility: 0-1 years of experience. Open to 2025 or 2026 graduates only.";
    const list = findKnockouts(job, { text: "Priya\nPune", content: student });
    expect(byId(list, "experience-years")).toMatchObject({ status: "met" });
    expect(byId(list, "graduation-year")).toMatchObject({ status: "met" });
  });

  it("ignores company blurbs and returns nothing when nothing applies", () => {
    const job = "Acme has 15 years in business and 5 years of growth. We have 20 years of experience serving clients.";
    expect(findKnockouts(job, { text: resumeText })).toEqual([]);
  });
});

describe("findKnockouts on hostile input", () => {
  it("stays fast on one huge run-on sentence", () => {
    vi.useRealTimers();
    const job = "3 years experience " + "we have ".repeat(2400) + "you";
    const started = performance.now();
    findKnockouts(job, { text: resumeText });
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
