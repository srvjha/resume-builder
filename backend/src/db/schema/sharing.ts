import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { timestamps } from "./columns.js";
import { resumes, resumeVersions } from "./resumes.js";

// A public link to a resume: site/<username>/<slug>.
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resumeId: uuid()
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    // Null means the link always shows the resume's latest version.
    pinnedVersionId: uuid().references(() => resumeVersions.id, {
      onDelete: "set null",
    }),
    // Contact details are masked unless the owner turns this on.
    showContact: boolean().notNull().default(false),
    // Listed on the user's public page at site/<username>.
    isListed: boolean().notNull().default(false),
    passwordHash: text(),
    // Paid: contacts stay masked until this password is given. Ignored while showContact is on or the owner is free.
    contactPasswordHash: text(),
    expiresAt: timestamp({ withTimezone: true }),
    viewCount: integer().notNull().default(0),
    lastViewedAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.userId, t.slug), index().on(t.resumeId), index().on(t.pinnedVersionId)],
);

// One row per view of a share link.
export const linkViews = pgTable(
  "link_views",
  {
    id: uuid().primaryKey().defaultRandom(),
    shareLinkId: uuid()
      .notNull()
      .references(() => shareLinks.id, { onDelete: "cascade" }),
    viewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Hash of IP + user agent with a daily salt: counts unique viewers
    // without storing the IP.
    visitorHash: text(),
    referrer: text(),
    country: text(),
    // Approximate place from the visitor's IP, as the hosting provider reports it; never the IP itself.
    region: text(),
    city: text(),
    device: text(),
  },
  (t) => [index().on(t.shareLinkId, t.viewedAt), index().on(t.viewedAt)],
);
