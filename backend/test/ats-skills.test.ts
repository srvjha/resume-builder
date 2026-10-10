import { describe, expect, it } from "vitest";
import { findSkills, jobRequirements, matchJob, titleMatch } from "../src/modules/ats/skills/match.js";

const skills = (text: string, context?: { skillsSection?: string }) => findSkills(text, context).map((h) => h.skill);

describe("ambiguous skill names", () => {
  it("ignores plain English uses", () => {
    const found = skills(
      "Own the go to market plan. Go beyond. Plan C is fine. Excel at teamwork. Spring 2024 intern.",
    );
    for (const name of ["Go", "C", "Excel", "Spring", "R"]) expect(found).not.toContain(name);
    expect(found).toContain("Go-to-market");
  });

  it("counts them in lists, beside cue words, and in the skills section", () => {
    expect(skills("Languages: C, C++, Python, Go, R")).toEqual(["C", "C++", "Python", "Go", "R"]);
    expect(skills("Built services in Go and Python; wrote R scripts")).toEqual(["Go", "Python", "R"]);
    expect(skills("C/C++ and Java/Spring")).toEqual(["C", "C++", "Java", "Spring"]);
    expect(skills("Proficient in Excel")).toEqual(["Excel"]);
    expect(skills("Excel (VBA)")).toEqual(["Excel", "VBA"]);
    expect(skills("Golang, RStudio, MS Excel, C programming")).toEqual(["Go", "R", "Excel", "C"]);
    expect(skills("Worked with Go daily", { skillsSection: "Go" })).toEqual(["Go"]);
  });

  it("needs the exact case", () => {
    expect(skills("go, python, react to incidents")).toEqual(["Python"]);
    expect(skills("Python, React")).toEqual(["Python", "React"]);
  });
});

describe("aliases and punctuation", () => {
  it("maps aliases to one skill", () => {
    expect(skills("JS, k8s, Postgres, GCP, DSA, Tally Prime, GST filing")).toEqual([
      "JavaScript",
      "Kubernetes",
      "PostgreSQL",
      "Google Cloud",
      "Data structures",
      "Tally",
      "GST",
    ]);
  });

  it("keeps symbol names whole", () => {
    expect(skills("C++, C#, .NET, Node.js. CI/CD and A/B testing")).toEqual([
      "C++",
      "C#",
      ".NET",
      "Node.js",
      "CI/CD",
      "A/B testing",
    ]);
  });
});

const JOB = `Backend Engineer
Responsibilities
- Build APIs with Docker
Requirements:
- 3+ years with Java
- PostgreSQL
Nice to have:
- Kafka
- Strong communication
Must have: Redis. Kubernetes is a plus.`;

describe("job requirements", () => {
  it("splits must-haves from nice-to-haves", () => {
    const job = jobRequirements(JOB);
    expect(job.hard.map((h) => h.skill)).toEqual(["Docker", "Java", "PostgreSQL", "Kafka", "Redis", "Kubernetes"]);
    expect(job.soft.map((h) => h.skill)).toEqual(["Communication"]);
    expect([...job.mustHave].sort()).toEqual(["Java", "PostgreSQL", "Redis"]);
  });

  it("weights must-have hard skills over other hard skills over soft skills", () => {
    // Total weight: 3 must-haves x 3 + 3 other hard x 2 + 1 soft = 16.
    const mustHaves = matchJob("Java, PostgreSQL, Redis", JOB);
    expect(mustHaves.score).toBeCloseTo(9 / 16);
    expect(mustHaves.mustHaveMissing).toEqual([]);
    const others = matchJob("Docker, Kafka, Kubernetes", JOB);
    expect(others.score).toBeCloseTo(6 / 16);
    expect(others.mustHaveMissing).toEqual(["Java", "PostgreSQL", "Redis"]);
    expect(matchJob("Excellent communication", JOB).score).toBeCloseTo(1 / 16);
    expect(matchJob("anything", "no skills here").score).toBe(0);
  });
});

describe("title match", () => {
  it("treats SDE, developer and engineer as one title and ignores seniority", () => {
    expect(titleMatch(["SDE II"], "Software Engineer\nWe build things.").level).toBe("exact");
    expect(titleMatch(["SDE Intern"], "Software Engineer\nWe build things.").level).toBe("close");
    expect(titleMatch(["SDE Intern"], "Software Engineer Intern\nSummer 2027.").level).toBe("exact");
    expect(titleMatch(["Senior Software Developer"], "We're hiring a Software Engineer to join us.")).toEqual({
      jobTitle: "Software Engineer",
      best: "Senior Software Developer",
      level: "exact",
    });
  });

  it("grades close and different titles", () => {
    expect(titleMatch(["Backend Engineer | Node.js"], "Software Engineer (Backend)").level).toBe("close");
    expect(titleMatch(["Business Analyst"], "Role: Data Analyst").level).toBe("none");
    expect(titleMatch(["Data Analyst"], "Position: Data Analyst").level).toBe("exact");
    expect(titleMatch(["Designer"], "About us").jobTitle).toBeNull();
  });
});

describe("long skill lists", () => {
  it("vouches through a whole list in linear time", () => {
    const text = "C, ".repeat(16_600) + "C programming";
    const started = performance.now();
    expect(skills(text)).toEqual(["C"]);
    expect(skills("Plan C, Go, R and C programming")).toEqual(["C", "Go", "R"]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
