import { z } from "zod";

// Stable ids let AI suggestions and diffs target a specific section, entry or bullet.
const id = z.string().min(1).max(64);
const shortText = z.string().trim().max(200);
// "2025" or "2025-06"; end dates may also be "present".
const yearMonth = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "Use YYYY or YYYY-MM");
const endDate = z.union([yearMonth, z.literal("present")]);

export const bulletSchema = z.object({
  id,
  // Supports **bold** for emphasised keywords.
  text: z.string().trim().max(600),
  hidden: z.boolean().default(false),
});

// Links render as <a href> on share pages and \href in PDFs, so only web and mail links are allowed.
const webUrl = z.url({ protocol: /^(https?|mailto)$/ });

const linkSchema = z.object({
  label: z.string().trim().max(40),
  url: webUrl,
  // Masked before the URL is sent to an AI model.
  sensitive: z.boolean().optional(),
});

const entryBase = {
  id,
  hidden: z.boolean().default(false),
  // Extra space after the entry on the PDF, in points.
  spaceAfter: z.number().int().min(0).max(24).optional(),
  bullets: z.array(bulletSchema).max(20).default([]),
};

const experienceEntry = z.object({
  ...entryBase,
  organization: shortText,
  // Masks the organization name (e.g. under NDA) before content is sent to an AI model.
  sensitive: z.boolean().optional(),
  role: shortText,
  location: shortText.optional(),
  start: yearMonth.optional(),
  end: endDate.optional(),
});

const educationEntry = z.object({
  ...entryBase,
  institution: shortText,
  degree: shortText.optional(),
  field: shortText.optional(),
  location: shortText.optional(),
  start: yearMonth.optional(),
  end: endDate.optional(),
  // CGPA or percentage as the user writes it, e.g. "8.7/10" or "92%".
  score: z.string().trim().max(20).optional(),
});

const projectEntry = z.object({
  ...entryBase,
  name: shortText,
  url: webUrl.optional(),
  // Extra labelled links shown after the title, e.g. "Live" and "Github".
  links: z.array(linkSchema).max(5).default([]),
  technologies: z.array(z.string().trim().max(40)).max(20).default([]),
  start: yearMonth.optional(),
  end: endDate.optional(),
});

// Achievements, certifications, positions of responsibility and any custom section.
const genericEntry = z.object({
  ...entryBase,
  title: shortText,
  subtitle: shortText.optional(),
  date: z.string().trim().max(40).optional(),
  url: webUrl.optional(),
});

const skillGroup = z.object({
  id,
  name: z.string().trim().max(60),
  items: z.array(z.string().trim().max(60)).max(40),
});

const sectionBase = {
  id,
  title: z.string().trim().min(1).max(60),
  hidden: z.boolean().default(false),
  // Extra space after the whole section on the PDF, in points.
  spaceAfter: z.number().int().min(0).max(24).optional(),
};

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ ...sectionBase, type: z.literal("experience"), entries: z.array(experienceEntry).max(30) }),
  z.object({ ...sectionBase, type: z.literal("education"), entries: z.array(educationEntry).max(10) }),
  z.object({ ...sectionBase, type: z.literal("projects"), entries: z.array(projectEntry).max(30) }),
  z.object({ ...sectionBase, type: z.literal("skills"), groups: z.array(skillGroup).max(15) }),
  z.object({ ...sectionBase, type: z.literal("list"), entries: z.array(genericEntry).max(40) }),
  z.object({ ...sectionBase, type: z.literal("summary"), text: z.string().trim().max(1000).default("") }),
  // Inline list of profile links, e.g. LeetCode, Codeforces.
  z.object({ ...sectionBase, type: z.literal("links"), links: z.array(linkSchema).max(15) }),
]);

export const basicsSchema = z.object({
  name: z.string().trim().max(100),
  headline: shortText.optional(),
  email: z.email().optional(),
  phone: z.string().trim().max(30).optional(),
  location: shortText.optional(),
  links: z.array(linkSchema).max(10).default([]),
  // Fields masked before content is sent to an AI model. Email and phone are always masked.
  sensitive: z
    .array(z.enum(["name", "location"]))
    .max(2)
    .optional(),
});

export const resumeContentSchema = z.object({
  basics: basicsSchema,
  sections: z.array(sectionSchema).max(20),
});

export type ResumeContent = z.infer<typeof resumeContentSchema>;
export type ResumeSection = z.infer<typeof sectionSchema>;

export const emptyResumeContent: ResumeContent = {
  basics: { name: "", links: [] },
  sections: [],
};
