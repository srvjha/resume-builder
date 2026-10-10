import { count, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../db/index.js";
import { promoCodes, promoRedemptions, users } from "../../db/schema/index.js";
import { track } from "../../lib/analytics.js";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors.js";
import { assertNotGuest, getSubscription, grantPlan, recomputePlan } from "../billing/billing.service.js";
import type { createPromoCodeBody } from "./promo-codes.schemas.js";

type PromoCode = typeof promoCodes.$inferSelect;

export const normalizeCode = (code: string) => code.trim().toUpperCase();

// Why a code can't be redeemed right now, or null when it can.
export function redeemProblem(
  code: Pick<PromoCode, "active" | "expiresAt" | "maxRedemptions"> | undefined,
  redeemed: number,
  now = new Date(),
) {
  if (!code?.active) return "This code doesn't exist or is no longer active";
  if (code.expiresAt && code.expiresAt <= now) return "This code has expired";
  if (code.maxRedemptions !== null && redeemed >= code.maxRedemptions) return "This code has been fully used";
  return null;
}

export async function redeemCode(userId: string, rawCode: string) {
  const promo = await db.transaction(async (tx) => {
    // Locking the user and the code serialises redemptions, so a limit is never exceeded by two at once.
    const [user] = await tx.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).for("update");
    if (user!.plan !== "free") throw new ConflictError("You already have a paid plan");
    await assertNotGuest(userId, tx);
    const [already] = await tx
      .select({ id: promoRedemptions.id })
      .from(promoRedemptions)
      .where(eq(promoRedemptions.userId, userId));
    if (already) throw new ConflictError("You've already used a code");

    const [code] = await tx
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, normalizeCode(rawCode)))
      .for("update");
    const [used] = code
      ? await tx.select({ count: count() }).from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, code.id))
      : [{ count: 0 }];
    const problem = redeemProblem(code, used!.count);
    if (problem) throw new AppError(422, "PROMO_CODE_INVALID", problem);

    const subscription = await grantPlan(userId, code!.plan, code!.months, tx);
    await tx.insert(promoRedemptions).values({ promoCodeId: code!.id, userId, subscriptionId: subscription.id });
    await recomputePlan(userId, tx);
    return code!;
  });
  track(userId, "promo_code_redeemed", { code: promo.code, kind: promo.kind, plan: promo.plan, months: promo.months });
  return getSubscription(userId);
}

// Each code with how its users did after redeeming: made a resume, tailored one, paid later.
export async function listPromoCodes() {
  const did = (condition: ReturnType<typeof sql>) =>
    sql<number>`count(${promoRedemptions.id}) filter (where ${condition})`.mapWith(Number);
  const [codes, recent] = await Promise.all([
    db
      .select({
        id: promoCodes.id,
        code: promoCodes.code,
        kind: promoCodes.kind,
        plan: promoCodes.plan,
        months: promoCodes.months,
        maxRedemptions: promoCodes.maxRedemptions,
        expiresAt: promoCodes.expiresAt,
        active: promoCodes.active,
        owner: promoCodes.owner,
        note: promoCodes.note,
        createdAt: promoCodes.createdAt,
        redemptions: count(promoRedemptions.id),
        madeResume: did(
          sql`exists (select 1 from resumes r where r.user_id = ${promoRedemptions.userId} and r.deleted_at is null)`,
        ),
        tailored: did(
          sql`exists (select 1 from ai_runs a where a.user_id = ${promoRedemptions.userId} and a.step = 'rewrite' and a.status = 'succeeded')`,
        ),
        paid: did(
          sql`exists (select 1 from payments p where p.user_id = ${promoRedemptions.userId} and p.status = 'captured')`,
        ),
        lastRedeemedAt: sql<Date | null>`max(${promoRedemptions.createdAt})`.mapWith((v) => (v ? new Date(v) : null)),
      })
      .from(promoCodes)
      .leftJoin(promoRedemptions, eq(promoRedemptions.promoCodeId, promoCodes.id))
      .groupBy(promoCodes.id)
      .orderBy(desc(promoCodes.createdAt)),
    db
      .select({
        code: promoCodes.code,
        userId: users.id,
        email: users.email,
        name: users.name,
        redeemedAt: promoRedemptions.createdAt,
      })
      .from(promoRedemptions)
      .innerJoin(promoCodes, eq(promoCodes.id, promoRedemptions.promoCodeId))
      .innerJoin(users, eq(users.id, promoRedemptions.userId))
      .orderBy(desc(promoRedemptions.createdAt))
      .limit(25),
  ]);
  return { codes, recent };
}

export async function createPromoCode(adminId: string, input: z.infer<typeof createPromoCodeBody>) {
  const code = normalizeCode(input.code);
  const [existing] = await db.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.code, code));
  if (existing) throw new ConflictError(`The code ${code} already exists`);
  const [created] = await db
    .insert(promoCodes)
    .values({ ...input, code })
    .returning({ id: promoCodes.id });
  track(adminId, "admin_promo_code_created", { code, kind: input.kind, plan: input.plan, months: input.months });
  return created!;
}

export async function setPromoCodeActive(id: string, active: boolean) {
  const [updated] = await db
    .update(promoCodes)
    .set({ active })
    .where(eq(promoCodes.id, id))
    .returning({ id: promoCodes.id });
  if (!updated) throw new NotFoundError("Promo code");
}
