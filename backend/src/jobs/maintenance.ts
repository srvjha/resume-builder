import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { resumes, subscriptions, uploads, users } from "../db/schema/index.js";
import { logger } from "../lib/logger.js";
import { storage } from "../lib/storage.js";
import { recomputePlan } from "../modules/billing/billing.service.js";

const DAY = 24 * 60 * 60 * 1000;

// Season Passes and cancelled Pro plans end when their period ends. Also covers missed webhooks.
export async function expireSubscriptions() {
  const lapsed = await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        inArray(subscriptions.status, ["active", "cancelled", "past_due"]),
        isNotNull(subscriptions.currentPeriodEnd),
        lt(subscriptions.currentPeriodEnd, new Date()),
      ),
    )
    .returning({ userId: subscriptions.userId });

  const userIds = [...new Set(lapsed.map((row) => row.userId))];
  for (const userId of userIds) await recomputePlan(userId);
  logger.info({ expired: lapsed.length, users: userIds.length }, "Expired subscriptions");
}

// Deleted resumes can be recovered for 30 days; after that they're removed for good.
export async function purgeDeletedResumes() {
  const purged = await db
    .delete(resumes)
    .where(and(isNotNull(resumes.deletedAt), lt(resumes.deletedAt, new Date(Date.now() - 30 * DAY))))
    .returning({ id: resumes.id });
  logger.info({ purged: purged.length }, "Purged deleted resumes");
}

// Uploads only matter during import; the extracted content lives in resumes.
export async function purgeOldUploads() {
  const old = await db
    .delete(uploads)
    .where(lt(uploads.createdAt, new Date(Date.now() - 30 * DAY)))
    .returning({ storageKey: uploads.storageKey });
  for (const { storageKey } of old) await storage.deletePrefix(storageKey);
  logger.info({ purged: old.length }, "Purged old uploads");
}

// Compiled PDFs are cached by a hash of their LaTeX, shared across users, so they can't be tied to an account.
// Anything not reused within 30 days is dropped and recompiled if needed.
export async function purgeCompiledPdfs() {
  const removed = await storage.deleteOlder("compiled/", new Date(Date.now() - 30 * DAY));
  logger.info({ removed }, "Purged cached PDFs");
}

// Guest accounts are for trying the app; they and their data go after 7 days.
export async function purgeGuestUsers() {
  const guests = await db
    .delete(users)
    .where(and(eq(users.isAnonymous, true), lt(users.createdAt, new Date(Date.now() - 7 * DAY))))
    .returning({ id: users.id });
  for (const { id } of guests) await storage.deletePrefix(`users/${id}/`);
  logger.info({ purged: guests.length }, "Purged guest users");
}

export const maintenanceTasks = {
  "expire-subscriptions": expireSubscriptions,
  "purge-deleted-resumes": purgeDeletedResumes,
  "purge-old-uploads": purgeOldUploads,
  "purge-compiled-pdfs": purgeCompiledPdfs,
  "purge-guest-users": purgeGuestUsers,
} as const;

export type MaintenanceTask = keyof typeof maintenanceTasks;
