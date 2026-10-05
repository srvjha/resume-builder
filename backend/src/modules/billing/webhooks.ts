import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { payments, subscriptions, webhookEvents } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";
import { recomputePlan } from "./billing.service.js";
import { track } from "../../lib/analytics.js";

type Entity = Record<string, unknown> & { id: string };
type RazorpayEvent = {
  event: string;
  payload: {
    payment?: {
      entity: Entity & { order_id?: string; method?: string; amount?: number; notes?: Record<string, string> };
    };
    subscription?: {
      entity: Entity & { current_start?: number; current_end?: number; notes?: Record<string, string> };
    };
    refund?: { entity: Entity & { payment_id?: string } };
  };
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SEASON_PASS_MONTHS = 6;
const fromUnix = (seconds?: number) => (seconds ? new Date(seconds * 1000) : null);

// Razorpay retries deliveries; each event id is processed once. Recorded in the same transaction as the
// event's effects, so a failure rolls both back and the retry runs it again.
async function firstDelivery(tx: Tx, eventId: string | undefined) {
  if (!eventId) return true;
  const inserted = await tx
    .insert(webhookEvents)
    .values({ id: `razorpay:${eventId}` })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  return inserted.length > 0;
}

async function onPaymentCaptured(
  tx: Tx,
  payment: NonNullable<RazorpayEvent["payload"]["payment"]>["entity"],
  raw: unknown,
) {
  if (!payment.order_id) return null; // Subscription payments are handled by subscription.charged.
  const [row] = await tx.select().from(payments).where(eq(payments.razorpayOrderId, payment.order_id)).limit(1);
  if (!row || row.status === "captured") return null;

  await tx
    .update(payments)
    .set({ status: "captured", razorpayPaymentId: payment.id, method: payment.method ?? null, raw })
    .where(eq(payments.id, row.id));

  if (row.subscriptionId) {
    // A new Season Pass extends any time left on a current one.
    const [current] = await tx
      .select({ end: subscriptions.currentPeriodEnd })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, row.userId),
          eq(subscriptions.plan, "season_pass"),
          eq(subscriptions.status, "active"),
        ),
      )
      .orderBy(subscriptions.currentPeriodEnd);
    const start = current?.end && current.end > new Date() ? current.end : new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + SEASON_PASS_MONTHS);
    await tx
      .update(subscriptions)
      .set({ status: "active", currentPeriodStart: start, currentPeriodEnd: end })
      .where(eq(subscriptions.id, row.subscriptionId));
  }
  await recomputePlan(row.userId, tx);
  return () => track(row.userId, "payment_captured", { amount_inr: row.amountPaise / 100 });
}

async function onSubscriptionEvent(tx: Tx, event: RazorpayEvent, raw: unknown) {
  const remote = event.payload.subscription?.entity;
  if (!remote) return;
  const [row] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.razorpaySubscriptionId, remote.id))
    .limit(1);
  if (!row) {
    logger.warn({ subscriptionId: remote.id }, "Webhook for unknown subscription");
    return;
  }

  const status =
    event.event === "subscription.cancelled"
      ? ("cancelled" as const)
      : event.event === "subscription.completed"
        ? ("expired" as const)
        : event.event === "subscription.halted"
          ? ("past_due" as const)
          : ("active" as const);

  await tx
    .update(subscriptions)
    .set({
      status,
      currentPeriodStart: fromUnix(remote.current_start) ?? row.currentPeriodStart,
      currentPeriodEnd: fromUnix(remote.current_end) ?? row.currentPeriodEnd,
      ...(status === "cancelled" && !row.cancelledAt && { cancelledAt: new Date() }),
    })
    .where(eq(subscriptions.id, row.id));

  const payment = event.payload.payment?.entity;
  if (event.event === "subscription.charged" && payment) {
    await tx
      .insert(payments)
      .values({
        userId: row.userId,
        subscriptionId: row.id,
        razorpayOrderId: payment.order_id ?? remote.id,
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount ?? 0,
        status: "captured",
        method: payment.method ?? null,
        raw,
      })
      .onConflictDoNothing({ target: payments.razorpayPaymentId });
  }
  await recomputePlan(row.userId, tx);
}

export async function handleRazorpayEvent(event: RazorpayEvent, eventId: string | undefined) {
  // Analytics run only after the transaction commits, so a rolled-back event is never counted.
  const afterCommit = await db.transaction(async (tx) => {
    if (!(await firstDelivery(tx, eventId))) return null;
    return applyEvent(tx, event);
  });
  afterCommit?.();
}

async function applyEvent(tx: Tx, event: RazorpayEvent) {
  switch (event.event) {
    case "payment.captured":
      return event.payload.payment ? onPaymentCaptured(tx, event.payload.payment.entity, event) : null;
    case "payment.failed":
      if (event.payload.payment?.entity.order_id) {
        await tx
          .update(payments)
          .set({ status: "failed", raw: event })
          .where(eq(payments.razorpayOrderId, event.payload.payment.entity.order_id));
      }
      return null;
    case "refund.processed": {
      const paymentId = event.payload.refund?.entity.payment_id;
      if (paymentId)
        await tx.update(payments).set({ status: "refunded" }).where(eq(payments.razorpayPaymentId, paymentId));
      return null;
    }
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.halted":
      await onSubscriptionEvent(tx, event, event);
      return null;
    default:
      logger.info({ event: event.event }, "Ignored Razorpay event");
      return null;
  }
}
