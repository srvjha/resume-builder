import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { aiRuns, resumes, users } from "../../db/schema/index.js";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { hasUserAiKey } from "../ai-keys/ai-keys.service.js";

export type Plan = (typeof users.$inferSelect)["plan"];
export type QuotaKind = "tailor" | "edit" | "import" | "draft";

// Monthly AI limits per plan; resumes are unlimited on every plan (1000 = unlimited). Paid limits are fair-use caps.
// Imports are free on every plan; the cap only stops abuse.
// Free gets one resume written from notes per account (counted for all time), to see it work once.
export const planLimits: Record<Plan, Record<QuotaKind | "resumes", number>> = {
  free: { resumes: 1000, tailor: 1, edit: 50, import: 20, draft: 1 },
  season_pass: { resumes: 1000, tailor: 40, edit: 1000, import: 20, draft: 30 },
  pro: { resumes: 1000, tailor: 60, edit: 1000, import: 20, draft: 30 },
};

const stepsFor: Record<QuotaKind, (typeof aiRuns.$inferSelect)["step"][]> = {
  tailor: ["rewrite"],
  edit: ["chat_edit", "inline_edit", "fix_compile"],
  import: ["import"],
  draft: ["draft"],
};

// Calendar month in UTC.
export function periodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function periodEnd(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

async function planOf(userId: string): Promise<Plan> {
  const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError("User");
  return user.plan;
}

// `allTime` counts every run, for allowances given once per account rather than per month.
async function usedThisPeriod(userId: string, kind: QuotaKind, allTime = false) {
  const [user] = await db.select({ resetAt: users.usageResetAt }).from(users).where(eq(users.id, userId));
  const start = allTime ? new Date(0) : periodStart();
  const since = user?.resetAt && user.resetAt > start ? user.resetAt : start;
  const [row] = await db
    .select({ value: count() })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.userId, userId),
        eq(aiRuns.status, "succeeded"),
        eq(aiRuns.byok, false),
        inArray(aiRuns.step, stepsFor[kind]),
        gte(aiRuns.createdAt, since),
        // A suggestion with no changes gave the user nothing to apply, so it isn't charged.
        sql`coalesce(jsonb_array_length(${aiRuns.patchOps}->'operations'), 1) > 0`,
      ),
    );
  return row?.value ?? 0;
}

async function activeResumes(userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), isNull(resumes.deletedAt)));
  return row?.value ?? 0;
}

function quotaError(message: string, limit: number, used: number, resetsAt?: Date) {
  return new AppError(402, "QUOTA_EXCEEDED", message, { limit, used, ...(resetsAt && { resetsAt }) });
}

export async function assertAiQuota(userId: string, kind: QuotaKind) {
  // Requests on the user's own key cost us nothing, so plan limits don't apply.
  if (await hasUserAiKey(userId)) return;
  const plan = await planOf(userId);
  const limit = planLimits[plan][kind];
  const once = kind === "draft" && plan === "free";
  const used = await usedThisPeriod(userId, kind, once);
  if (used >= limit && once) {
    throw quotaError(
      "You've used your free AI-written resume. Season Pass and Pro include more, or add your own AI key.",
      limit,
      used,
    );
  }
  if (used >= limit) {
    throw quotaError(`You've used all ${limit} ${kind} requests for this month`, limit, used, periodEnd());
  }
}

// Premium features (extra link controls, detailed analytics) need Season Pass or Pro.
export async function assertPaidPlan(userId: string, feature: string) {
  if ((await planOf(userId)) === "free")
    throw new AppError(402, "PLAN_REQUIRED", `${feature} is part of Season Pass and Pro`);
}

export async function assertResumeQuota(userId: string) {
  const limit = planLimits[await planOf(userId)].resumes;
  const used = await activeResumes(userId);
  if (used >= limit)
    throw quotaError(`You've reached the limit of ${limit} resumes. Delete some you no longer need.`, limit, used);
}

export async function getUsage(userId: string) {
  const plan = await planOf(userId);
  const limits = planLimits[plan];
  const [tailor, edit, importCount, draft, resumeCount, ownAiKey] = await Promise.all([
    usedThisPeriod(userId, "tailor"),
    usedThisPeriod(userId, "edit"),
    usedThisPeriod(userId, "import"),
    usedThisPeriod(userId, "draft", plan === "free"),
    activeResumes(userId),
    hasUserAiKey(userId),
  ]);
  return {
    plan,
    ownAiKey,
    periodStart: periodStart(),
    periodEnd: periodEnd(),
    resumes: { used: resumeCount, limit: limits.resumes },
    tailor: { used: tailor, limit: limits.tailor },
    edit: { used: edit, limit: limits.edit },
    import: { used: importCount, limit: limits.import },
    draft: { used: draft, limit: limits.draft },
  };
}
