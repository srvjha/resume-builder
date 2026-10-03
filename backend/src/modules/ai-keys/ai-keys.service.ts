import { generateText } from "ai";
import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../db/index.js";
import { userAiKeys } from "../../db/schema/index.js";
import { userKeyError } from "../../lib/ai/key-errors.js";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors.js";
import { type AiProvider, createModel, defaultModels, listProviderModels } from "../../lib/ai/models.js";
import { open, seal } from "../../lib/secret-box.js";
import type { putAiKeyBody, updateAiKeyBody } from "./ai-keys.schemas.js";
import { track } from "../../lib/analytics.js";

const publicColumns = {
  provider: userAiKeys.provider,
  enabled: userAiKeys.enabled,
  modelId: userAiKeys.modelId,
  modelIds: userAiKeys.modelIds,
  keyHint: userAiKeys.keyHint,
  verifiedAt: userAiKeys.verifiedAt,
};

export async function getAiKey(userId: string) {
  const [row] = await db.select(publicColumns).from(userAiKeys).where(eq(userAiKeys.userId, userId)).limit(1);
  return row ?? null;
}

// The decrypted key for AI calls. Only the AI layer should call this.
export async function loadUserAiKey(userId: string) {
  const [row] = await db.select().from(userAiKeys).where(eq(userAiKeys.userId, userId)).limit(1);
  if (!row?.enabled) return undefined;
  return { provider: row.provider, apiKey: openKey(row.encryptedKey), ...(row.modelId && { modelId: row.modelId }) };
}

function openKey(encryptedKey: string) {
  try {
    return open(encryptedKey);
  } catch {
    // The encryption secret changed since the key was saved.
    throw new AppError(422, "AI_KEY_UNREADABLE", "Your saved API key can't be read anymore. Add it again in Settings.");
  }
}

// OpenRouter's catalog is public, so the browser fetches it directly.
export async function listAiKeyModels(userId: string) {
  const [saved] = await db.select().from(userAiKeys).where(eq(userAiKeys.userId, userId)).limit(1);
  if (!saved) throw new NotFoundError("AI key");
  if (saved.provider === "openrouter") return [];
  return listProviderModels(saved.provider, openKey(saved.encryptedKey));
}

export async function hasUserAiKey(userId: string) {
  return (await getAiKey(userId))?.enabled === true;
}

// One tiny request per model the key will be used with, so a bad key or model fails here, not mid-tailor.
async function verify(provider: AiProvider, apiKey: string, modelId: string | undefined) {
  const models = modelId ? [modelId] : [...new Set(Object.values(defaultModels[provider]))];
  for (const id of models) {
    try {
      await generateText({
        model: createModel(provider, apiKey, id),
        prompt: "Reply with the single word OK.",
        maxOutputTokens: 16,
        abortSignal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw userKeyError(provider, err, "saving");
    }
  }
}

export async function putAiKey(userId: string, input: z.infer<typeof putAiKeyBody>) {
  const modelId = input.modelId || null;
  await verify(input.provider, input.apiKey, modelId ?? undefined);
  const values = {
    provider: input.provider,
    enabled: true,
    modelId,
    modelIds: modelId ? [modelId] : [],
    encryptedKey: seal(input.apiKey),
    keyHint: input.apiKey.slice(-4),
    verifiedAt: new Date(),
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(userAiKeys)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: userAiKeys.userId,
      set: {
        ...values,
        modelIds: sql`CASE WHEN ${userAiKeys.provider} = excluded.provider
          THEN ARRAY(SELECT DISTINCT unnest(${userAiKeys.modelIds} || excluded.model_ids))
          ELSE excluded.model_ids END`,
      },
    })
    .returning(publicColumns);
  track(userId, "ai_key_added", { provider: input.provider, custom_model: Boolean(modelId) });
  return row!;
}

export async function updateAiKey(userId: string, input: z.infer<typeof updateAiKeyBody>) {
  const [saved] = await db.select().from(userAiKeys).where(eq(userAiKeys.userId, userId)).limit(1);
  if (!saved) throw new NotFoundError("AI key");

  const values: Partial<typeof userAiKeys.$inferInsert> = { updatedAt: new Date() };
  if (input.enabled !== undefined) values.enabled = input.enabled;
  if (input.modelId !== undefined && input.modelId !== saved.modelId) {
    await verify(saved.provider, openKey(saved.encryptedKey), input.modelId ?? undefined);
    values.modelId = input.modelId;
    values.verifiedAt = new Date();
  }

  const [row] = await db
    .update(userAiKeys)
    .set({
      ...values,
      ...(values.modelId && {
        modelIds: sql`ARRAY(SELECT DISTINCT unnest(array_append(${userAiKeys.modelIds}, ${values.modelId}::text)))`,
      }),
    })
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.encryptedKey, saved.encryptedKey)))
    .returning(publicColumns);
  if (!row) throw new ConflictError("Your AI key changed. Refresh Settings and try again.");
  return row;
}

export async function deleteAiKey(userId: string) {
  await db.delete(userAiKeys).where(eq(userAiKeys.userId, userId));
}
