import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../errors.js";

export type AiProvider = "openai" | "anthropic" | "openrouter";

// fast: extraction, JD parsing, inline edits. smart: tailoring plan and rewrite.
export type ModelTier = "fast" | "smart";

export const defaultModels: Record<AiProvider, Record<ModelTier, string>> = {
  openai: { fast: "gpt-5.4-mini", smart: "gpt-5.5" },
  anthropic: { fast: "claude-haiku-4-5", smart: "claude-sonnet-5" },
  openrouter: { fast: "openai/gpt-5.4-mini", smart: "anthropic/claude-sonnet-5" },
};

export type ResolvedModel = {
  model: LanguageModel;
  provider: AiProvider;
  modelId: string;
};

export function createModel(provider: AiProvider, apiKey: string, modelId: string): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelId);
  }
}

const apiKeys: Record<AiProvider, string | undefined> = {
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  openrouter: env.OPENROUTER_API_KEY,
};

// A user-supplied key (BYOK) takes precedence over the server's own configuration.
export function resolveModel(
  tier: ModelTier,
  userKey?: { provider: AiProvider; apiKey: string; modelId?: string },
): ResolvedModel {
  const provider = userKey?.provider ?? env.AI_PROVIDER;
  const apiKey = userKey?.apiKey ?? apiKeys[provider];
  if (!apiKey) {
    throw new AppError(503, "AI_NOT_CONFIGURED", `No API key configured for ${provider}`);
  }

  const override = tier === "fast" ? env.AI_MODEL_FAST : env.AI_MODEL_SMART;
  const modelId = userKey?.modelId ?? (userKey ? undefined : override) ?? defaultModels[provider][tier];

  return { model: createModel(provider, apiKey, modelId), provider, modelId };
}

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string(), display_name: z.string().optional(), created: z.number().optional() })),
});

// OpenAI also lists embedding, audio, image and moderation models, which can't write a resume.
const openAiChatModel = /^(gpt-|chatgpt-|o\d)(?!.*(audio|realtime|transcribe|tts|image|search))/;

export function parseProviderModels(provider: "openai" | "anthropic", body: unknown) {
  const { data } = modelListSchema.parse(body);
  return data
    .filter((model) => provider === "anthropic" || openAiChatModel.test(model.id))
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .map((model) => ({ id: model.id, name: model.display_name ?? model.id }));
}

export async function listProviderModels(provider: "openai" | "anthropic", apiKey: string) {
  const response = await fetch(
    provider === "openai" ? "https://api.openai.com/v1/models" : "https://api.anthropic.com/v1/models?limit=1000",
    {
      headers:
        provider === "openai"
          ? { authorization: `Bearer ${apiKey}` }
          : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new AppError(502, "AI_MODELS_UNAVAILABLE", "We couldn't load the model list. Enter a model ID instead.");
  }
  return parseProviderModels(provider, await response.json());
}
