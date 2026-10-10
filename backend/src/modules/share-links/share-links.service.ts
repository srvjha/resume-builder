import { and, count, countDistinct, desc, eq, gte, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/index.js";
import { linkViews, resumeVersions, shareLinks, users } from "../../db/schema/index.js";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors.js";
import { hashPassword } from "../../lib/passwords.js";
import { getOwnedResume } from "../resumes/resumes.service.js";
import { assertPaidPlan } from "../usage/quotas.js";
import { slugify } from "../users/usernames.js";
import { track } from "../../lib/analytics.js";

type ShareLinkRow = typeof shareLinks.$inferSelect;

// Code-mode resumes print their LaTeX source, contact lines included, so a lock would hide nothing.
function assertContactLockAllowed(mode: string) {
  if (mode === "code") {
    throw new AppError(
      400,
      "CONTACT_LOCK_UNAVAILABLE",
      "LaTeX resumes show their contact lines, so they can't lock them",
    );
  }
}

async function ownerUsername(userId: string) {
  const [owner] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
  return owner!.username;
}

function toResponse(link: ShareLinkRow, username: string) {
  const {
    passwordHash,
    contactPasswordHash,
    deletedAt: _deletedAt,
    userId: _userId,
    updatedAt: _updatedAt,
    ...rest
  } = link;
  return {
    ...rest,
    hasPassword: Boolean(passwordHash),
    hasContactPassword: Boolean(contactPasswordHash),
    url: `${env.FRONTEND_URL}/${username}/${link.slug}`,
  };
}

async function slugTaken(userId: string, slug: string, exceptId?: string) {
  const [existing] = await db
    .select({ id: shareLinks.id })
    .from(shareLinks)
    .where(
      and(eq(shareLinks.userId, userId), eq(shareLinks.slug, slug), exceptId ? ne(shareLinks.id, exceptId) : undefined),
    )
    .limit(1);
  return Boolean(existing);
}

async function uniqueSlug(userId: string, base: string) {
  const slug = slugify(base);
  const root = slug.length >= 3 ? slug : "resume";
  if (!(await slugTaken(userId, root))) return root;
  for (let n = 2; n < 100; n++) {
    const candidate = `${root.slice(0, 26)}-${n}`;
    if (!(await slugTaken(userId, candidate))) return candidate;
  }
  throw new ConflictError("Could not generate a free slug; pick one yourself");
}

async function assertVersionOfResume(resumeId: string, versionId: string) {
  const [version] = await db
    .select({ id: resumeVersions.id })
    .from(resumeVersions)
    .where(and(eq(resumeVersions.id, versionId), eq(resumeVersions.resumeId, resumeId)))
    .limit(1);
  if (!version) throw new NotFoundError("Version");
}

export async function getOwnedShareLink(userId: string, shareLinkId: string) {
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.id, shareLinkId), eq(shareLinks.userId, userId), isNull(shareLinks.deletedAt)))
    .limit(1);
  if (!link) throw new NotFoundError("Share link");
  return link;
}

export async function createShareLink(
  userId: string,
  resumeId: string,
  input: {
    slug?: string | undefined;
    pinnedVersionId: string | null;
    showContact: boolean;
    isListed: boolean;
    password?: string | undefined;
    contactPassword?: string | undefined;
    expiresAt?: Date | undefined;
  },
) {
  const resume = await getOwnedResume(userId, resumeId);
  if (input.contactPassword) assertContactLockAllowed(resume.mode);
  if (input.contactPassword) await assertPaidPlan(userId, "Contact password");
  if (input.pinnedVersionId) await assertVersionOfResume(resume.id, input.pinnedVersionId);
  if (input.slug && (await slugTaken(userId, input.slug))) throw new ConflictError("You already use this slug");

  const [link] = await db
    .insert(shareLinks)
    .values({
      userId,
      resumeId: resume.id,
      slug: input.slug ?? (await uniqueSlug(userId, resume.title)),
      pinnedVersionId: input.pinnedVersionId,
      showContact: input.showContact,
      isListed: input.isListed,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      contactPasswordHash: input.contactPassword ? await hashPassword(input.contactPassword) : null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  track(userId, "share_link_created", {
    pinned: Boolean(input.pinnedVersionId),
    password: Boolean(input.password),
    shows_contact: input.showContact,
    contact_password: Boolean(input.contactPassword),
  });
  return toResponse(link!, await ownerUsername(userId));
}

export async function listShareLinks(userId: string, resumeId: string) {
  const resume = await getOwnedResume(userId, resumeId);
  const links = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.resumeId, resume.id), isNull(shareLinks.deletedAt)))
    .orderBy(desc(shareLinks.createdAt));
  const username = await ownerUsername(userId);
  return links.map((link) => toResponse(link, username));
}

export async function getShareLink(userId: string, shareLinkId: string) {
  const link = await getOwnedShareLink(userId, shareLinkId);
  return toResponse(link, await ownerUsername(userId));
}

export async function updateShareLink(
  userId: string,
  shareLinkId: string,
  changes: {
    slug?: string | undefined;
    pinnedVersionId?: string | null | undefined;
    showContact?: boolean | undefined;
    isListed?: boolean | undefined;
    password?: string | null | undefined;
    contactPassword?: string | null | undefined;
    expiresAt?: Date | null | undefined;
  },
) {
  const link = await getOwnedShareLink(userId, shareLinkId);
  if (changes.contactPassword) assertContactLockAllowed((await getOwnedResume(userId, link.resumeId)).mode);
  if (changes.contactPassword) await assertPaidPlan(userId, "Contact password");
  if (changes.slug && (await slugTaken(userId, changes.slug, link.id)))
    throw new ConflictError("You already use this slug");
  if (changes.pinnedVersionId) await assertVersionOfResume(link.resumeId, changes.pinnedVersionId);

  const [updated] = await db
    .update(shareLinks)
    .set({
      ...(changes.slug && { slug: changes.slug }),
      ...(changes.pinnedVersionId !== undefined && { pinnedVersionId: changes.pinnedVersionId }),
      ...(changes.showContact !== undefined && { showContact: changes.showContact }),
      ...(changes.isListed !== undefined && { isListed: changes.isListed }),
      ...(changes.password !== undefined && {
        passwordHash: changes.password ? await hashPassword(changes.password) : null,
      }),
      // Showing contacts and locking them are exclusive, so picking one clears the other.
      ...(changes.showContact && { contactPasswordHash: null }),
      ...(changes.contactPassword !== undefined && {
        contactPasswordHash: changes.contactPassword ? await hashPassword(changes.contactPassword) : null,
      }),
      ...(changes.contactPassword && { showContact: false }),
      ...(changes.expiresAt !== undefined && { expiresAt: changes.expiresAt }),
      updatedAt: new Date(),
    })
    .where(eq(shareLinks.id, link.id))
    .returning();
  return toResponse(updated!, await ownerUsername(userId));
}

export async function deleteShareLink(userId: string, shareLinkId: string) {
  const link = await getOwnedShareLink(userId, shareLinkId);
  await db.update(shareLinks).set({ deletedAt: new Date() }).where(eq(shareLinks.id, link.id));
}

export async function getShareLinkStats(userId: string, shareLinkId: string) {
  const link = await getOwnedShareLink(userId, shareLinkId);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = and(eq(linkViews.shareLinkId, link.id), gte(linkViews.viewedAt, since));
  const day = sql<string>`to_char(date_trunc('day', ${linkViews.viewedAt}), 'YYYY-MM-DD')`;

  const [[unique], byDay, referrers, countries, places] = await Promise.all([
    db
      .select({ value: countDistinct(linkViews.visitorHash) })
      .from(linkViews)
      .where(eq(linkViews.shareLinkId, link.id)),
    db.select({ day, views: count() }).from(linkViews).where(recent).groupBy(day).orderBy(day),
    db
      .select({ referrer: sql<string>`coalesce(${linkViews.referrer}, 'direct')`, views: count() })
      .from(linkViews)
      .where(recent)
      .groupBy(sql`1`)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ country: sql<string>`coalesce(${linkViews.country}, 'unknown')`, views: count() })
      .from(linkViews)
      .where(recent)
      .groupBy(sql`1`)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ city: linkViews.city, region: linkViews.region, country: linkViews.country, views: count() })
      .from(linkViews)
      .where(and(recent, isNotNull(linkViews.city)))
      .groupBy(linkViews.city, linkViews.region, linkViews.country)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  return {
    viewCount: link.viewCount,
    uniqueVisitors: unique?.value ?? 0,
    lastViewedAt: link.lastViewedAt,
    viewsByDay: byDay,
    topReferrers: referrers,
    countries,
    places,
  };
}
