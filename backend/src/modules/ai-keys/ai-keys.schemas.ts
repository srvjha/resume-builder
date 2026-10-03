import { z } from "zod";

export const aiProviderSchema = z.enum(["openai", "anthropic", "openrouter"]);

const modelIdSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^~?[\w.:/-]+$/, "Letters, numbers and . : / - _ only, with an optional leading ~")
  .nullish();

export const putAiKeyBody = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().trim().min(10).max(300),
  // e.g. "gpt-5.4-mini" or, on OpenRouter, "anthropic/claude-sonnet-5". Empty uses the provider's defaults.
  modelId: modelIdSchema,
});

export const updateAiKeyBody = z
  .object({ enabled: z.boolean().optional(), modelId: modelIdSchema })
  .strict()
  .refine((body) => body.enabled !== undefined || body.modelId !== undefined, "Provide enabled or modelId");

export const aiKeyResponse = z
  .object({
    provider: aiProviderSchema,
    enabled: z.boolean(),
    modelId: z.string().nullable(),
    modelIds: z.array(z.string()),
    keyHint: z.string(),
    verifiedAt: z.date(),
  })
  .nullable();
