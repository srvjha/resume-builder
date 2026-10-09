import { z } from "zod";
import { resumeContentSchema } from "../../schemas/resume-content.js";
import { resumeLayoutSchema } from "../../templates/layout.js";

export const createImportBody = z.union([
  z.object({ uploadId: z.uuid() }),
  z.object({ text: z.string().trim().min(20).max(50_000) }),
]);

export const createDraftBody = z.object({
  role: z.string().trim().min(2).max(100),
  notes: z.string().trim().min(40).max(20_000),
});

export const importResponse = z.object({
  content: resumeContentSchema,
  aiRunId: z.uuid(),
  // PDF lines the AI left out. Placed ones are already in content as hidden bullets; the rest had no entry to go under.
  missed: z.array(z.object({ text: z.string(), placed: z.boolean() })).default([]),
  // How the source PDF showed its header links, when it named them ("LinkedIn") instead of printing the address.
  linkStyle: resumeLayoutSchema.shape.links,
});
