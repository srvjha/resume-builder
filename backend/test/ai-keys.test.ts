import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  generateText: vi.fn(),
  createModel: vi.fn(),
}));

vi.mock("../src/db/index.js", () => ({
  db: {
    select: mocks.select,
    update: () => ({ set: mocks.set }),
  },
}));
vi.mock("ai", () => ({ generateText: mocks.generateText, APICallError: { isInstance: () => false } }));
vi.mock("../src/lib/ai/models.js", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createModel: mocks.createModel,
}));

import { seal } from "../src/lib/secret-box.js";
import { userAiKeys } from "../src/db/schema/index.js";
import { defaultModels } from "../src/lib/ai/models.js";
import { putAiKeyBody, updateAiKeyBody } from "../src/modules/ai-keys/ai-keys.schemas.js";
import { getAiKey, hasUserAiKey, loadUserAiKey, updateAiKey } from "../src/modules/ai-keys/ai-keys.service.js";
import { assertAiQuota } from "../src/modules/usage/quotas.js";

const apiKey = "sk-test-key-never-sent-to-a-provider";
let saved: typeof userAiKeys.$inferSelect | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  saved = {
    userId: "00000000-0000-4000-8000-000000000001",
    provider: "openai",
    enabled: true,
    modelId: "old-model",
    modelIds: ["old-model"],
    encryptedKey: seal(apiKey),
    keyHint: "ider",
    verifiedAt: new Date("2026-10-01"),
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-01"),
  };
  mocks.select.mockImplementation((columns) => ({
    from: (table: unknown) => {
      const rows =
        table === userAiKeys
          ? saved
            ? [
                columns
                  ? Object.fromEntries(Object.keys(columns).map((key) => [key, saved![key as keyof typeof saved]]))
                  : saved,
              ]
            : []
          : columns?.plan
            ? [{ plan: "free" }]
            : columns?.value
              ? [{ value: 1 }]
              : [{ resetAt: null }];
      return { where: () => Object.assign(Promise.resolve(rows), { limit: async () => rows }) };
    },
  }));
  mocks.set.mockImplementation((values) => ({
    where: () => ({
      returning: (columns: object) => {
        mocks.returning(columns);
        Object.assign(saved!, Object.fromEntries(Object.entries(values).filter(([key]) => key !== "modelIds")));
        return Promise.resolve([
          Object.fromEntries(Object.keys(columns).map((key) => [key, saved![key as keyof typeof saved]])),
        ]);
      },
    }),
  }));
  mocks.generateText.mockResolvedValue({});
  mocks.createModel.mockReturnValue("mock-model");
});

describe("AI key settings", () => {
  it("validates toggle and model updates at the API boundary", () => {
    expect(updateAiKeyBody.parse({ enabled: false })).toEqual({ enabled: false });
    expect(updateAiKeyBody.parse({ modelId: " z-ai/glm-5.3-flash " })).toEqual({ modelId: "z-ai/glm-5.3-flash" });
    expect(updateAiKeyBody.parse({ modelId: null })).toEqual({ modelId: null });
    expect(updateAiKeyBody.parse({ modelId: "~openai/gpt-luna-latest" }).modelId).toBe("~openai/gpt-luna-latest");
    expect(putAiKeyBody.parse({ provider: "openrouter", apiKey, modelId: "~openai/gpt-luna-latest" }).modelId).toBe(
      "~openai/gpt-luna-latest",
    );
    for (const body of [
      {},
      { enabled: "false" },
      { modelId: "" },
      { modelId: "bad model" },
      { modelId: "openai/~invalid-alias" },
      { modelId: "x".repeat(101) },
      { enabled: false, apiKey },
    ]) {
      expect(updateAiKeyBody.safeParse(body).success).toBe(false);
    }
  });

  it("disables the key without decrypting, deleting, or verifying it", async () => {
    saved!.encryptedKey = "unreadable";
    const encryptedKey = saved!.encryptedKey;
    const result = await updateAiKey(saved!.userId, { enabled: false });
    expect(result).toMatchObject({ enabled: false, modelId: "old-model", modelIds: ["old-model"] });
    expect(result).not.toHaveProperty("encryptedKey");
    expect(saved!.encryptedKey).toBe(encryptedKey);
    expect(await loadUserAiKey(saved!.userId)).toBeUndefined();
    expect(await hasUserAiKey(saved!.userId)).toBe(false);
    expect((await getAiKey(saved!.userId))?.enabled).toBe(false);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("reenables the saved key for AI selection and quota bypass", async () => {
    saved!.enabled = false;
    await updateAiKey(saved!.userId, { enabled: true });
    expect(await hasUserAiKey(saved!.userId)).toBe(true);
    expect(await loadUserAiKey(saved!.userId)).toEqual({ provider: "openai", apiKey, modelId: "old-model" });
    await expect(assertAiQuota(saved!.userId, "tailor")).resolves.toBeUndefined();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("enforces account plan limits while a saved key is disabled", async () => {
    saved!.enabled = false;
    await expect(assertAiQuota(saved!.userId, "tailor")).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("tests a new model with the stored key and preserves its disabled state", async () => {
    saved!.enabled = false;
    const encryptedKey = saved!.encryptedKey;
    const result = await updateAiKey(saved!.userId, { modelId: "new-model" });
    expect(mocks.createModel).toHaveBeenCalledWith("openai", apiKey, "new-model");
    expect(mocks.generateText).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ modelId: "new-model", enabled: false });
    expect(result).not.toHaveProperty("encryptedKey");
    expect(saved!.encryptedKey).toBe(encryptedKey);
    expect(result.verifiedAt).not.toEqual(new Date("2026-10-01"));
  });

  it("keeps the previous model and toggle when verification fails", async () => {
    mocks.generateText.mockRejectedValue(new Error("provider failure"));
    await expect(updateAiKey(saved!.userId, { modelId: "bad-model", enabled: false })).rejects.toThrow();
    expect(saved).toMatchObject({ modelId: "old-model", modelIds: ["old-model"], enabled: true });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("verifies both default models before clearing a custom model", async () => {
    const result = await updateAiKey(saved!.userId, { modelId: null });
    expect(result.modelId).toBeNull();
    expect(result.modelIds).toEqual(["old-model"]);
    expect(mocks.createModel.mock.calls.map((call) => call[2])).toEqual(Object.values(defaultModels.openai));
  });

  it("does not reverify an unchanged model", async () => {
    await updateAiKey(saved!.userId, { modelId: "old-model" });
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(saved!.verifiedAt).toEqual(new Date("2026-10-01"));
  });

  it("rejects updates when no key is saved", async () => {
    saved = undefined;
    await expect(updateAiKey("missing-user", { enabled: false })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await hasUserAiKey("missing-user")).toBe(false);
    expect(await loadUserAiKey("missing-user")).toBeUndefined();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("reports unreadable keys without changing their model", async () => {
    saved!.encryptedKey = "unreadable";
    await expect(updateAiKey(saved!.userId, { modelId: "new-model" })).rejects.toMatchObject({
      code: "AI_KEY_UNREADABLE",
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("rejects a model update when the saved key changed during verification", async () => {
    mocks.set.mockReturnValue({ where: () => ({ returning: async () => [] }) });
    await expect(updateAiKey(saved!.userId, { modelId: "new-model" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
