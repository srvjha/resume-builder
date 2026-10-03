import { generateText } from "ai";
import { and, eq, ne, sql } from "drizzle-orm";
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ownKey = (userId: string, provider: AiProvider) =>
  and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider));

export function listAiKeys(userId: string) {
  return db.select(publicColumns).from(userAiKeys).where(eq(userAiKeys.userId, userId)).orderBy(userAiKeys.createdAt);
}

async function findAiKey(userId: string, provider: AiProvider) {
  const [row] = await db.select().from(userAiKeys).where(ownKey(userId, provider)).limit(1);
  if (!row) throw new NotFoundError("AI key");
  return row;
}

// Only one key runs AI requests, so enabling one turns the user's others off.
function disableOthers(tx: Tx, userId: string, provider: AiProvider) {
  return tx
    .update(userAiKeys)
    .set({ enabled: false, updatedAt: new Date() })
    .where(and(eq(userAiKeys.userId, userId), ne(userAiKeys.provider, provider)));
}

// The decrypted enabled key for AI calls. Only the AI layer should call this.
export async function loadUserAiKey(userId: string) {
  const rows = await db.select().from(userAiKeys).where(eq(userAiKeys.userId, userId));
  const row = rows.find((key) => key.enabled);
  if (!row) return undefined;
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
export async function listAiKeyModels(userId: string, provider: AiProvider) {
  const saved = await findAiKey(userId, provider);
  if (saved.provider === "openrouter") return [];
  return listProviderModels(saved.provider, openKey(saved.encryptedKey));
}

export async function hasUserAiKey(userId: string) {
  return (await listAiKeys(userId)).some((key) => key.enabled);
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

export async function putAiKey(userId: string, provider: AiProvider, input: z.infer<typeof putAiKeyBody>) {
  const modelId = input.modelId || null;
  await verify(provider, input.apiKey, modelId ?? undefined);
  const values = {
    enabled: true,
    modelId,
    modelIds: modelId ? [modelId] : [],
    encryptedKey: seal(input.apiKey),
    keyHint: input.apiKey.slice(-4),
    verifiedAt: new Date(),
    updatedAt: new Date(),
  };
  const row = await db.transaction(async (tx) => {
    await disableOthers(tx, userId, provider);
    const [saved] = await tx
      .insert(userAiKeys)
      .values({ userId, provider, ...values })
      .onConflictDoUpdate({
        target: [userAiKeys.userId, userAiKeys.provider],
        set: { ...values, modelIds: sql`ARRAY(SELECT DISTINCT unnest(${userAiKeys.modelIds} || excluded.model_ids))` },
      })
      .returning(publicColumns);
    return saved!;
  });
  track(userId, "ai_key_added", { provider, custom_model: Boolean(modelId) });
  return row;
}

export async function updateAiKey(userId: string, provider: AiProvider, input: z.infer<typeof updateAiKeyBody>) {
  const saved = await findAiKey(userId, provider);

  const values: Partial<typeof userAiKeys.$inferInsert> = { updatedAt: new Date() };
  if (input.enabled !== undefined) values.enabled = input.enabled;
  if (input.modelId !== undefined && input.modelId !== saved.modelId) {
    await verify(saved.provider, openKey(saved.encryptedKey), input.modelId ?? undefined);
    values.modelId = input.modelId;
    values.verifiedAt = new Date();
  }

  return db.transaction(async (tx) => {
    if (values.enabled) await disableOthers(tx, userId, provider);
    const [row] = await tx
      .update(userAiKeys)
      .set({
        ...values,
        ...(values.modelId && {
          modelIds: sql`ARRAY(SELECT DISTINCT unnest(array_append(${userAiKeys.modelIds}, ${values.modelId}::text)))`,
        }),
      })
      .where(and(ownKey(userId, provider), eq(userAiKeys.encryptedKey, saved.encryptedKey)))
      .returning(publicColumns);
    if (!row) throw new ConflictError("Your AI key changed. Refresh Settings and try again.");
    return row;
  });
}

export async function deleteAiKey(userId: string, provider: AiProvider) {
  await db.delete(userAiKeys).where(ownKey(userId, provider));
}
