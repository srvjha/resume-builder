import { and, count, countDistinct, desc, eq, gte, isNull, lt, type SQL, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { linkViews, resumes, shareLinks } from "../../db/schema/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Every calendar day in the range, oldest first, so days without views still show as zero.
export function dayKeys(days: number, timeZone: string, now: Date) {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const keys = new Set<string>();
  for (let offset = days - 1; offset >= 0; offset--) keys.add(format.format(new Date(now.getTime() - offset * DAY_MS)));
  return [...keys];
}

export async function getAnalytics(userId: string, days: number, timeZone: string) {
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);
  const previousSince = new Date(since.getTime() - days * DAY_MS);

  const ownLinks = and(eq(shareLinks.userId, userId), isNull(shareLinks.deletedAt));
  const inRange = and(ownLinks, gte(linkViews.viewedAt, since));
  const inPrevious = and(ownLinks, gte(linkViews.viewedAt, previousSince), lt(linkViews.viewedAt, since));
  const views = () =>
    db
      .select({ views: count(), unique: countDistinct(linkViews.visitorHash) })
      .from(linkViews)
      .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id));
  const breakdown = (
    column: typeof linkViews.referrer | typeof linkViews.country | typeof linkViews.device | SQL,
    fallback: string,
  ) =>
    db
      .select({ label: sql<string>`coalesce(${column}, ${fallback})`, views: count() })
      .from(linkViews)
      .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id))
      .where(inRange)
      .groupBy(sql`1`)
      .orderBy(desc(count()))
      .limit(8);
  const day = sql<string>`to_char(${linkViews.viewedAt} at time zone ${timeZone}, 'YYYY-MM-DD')`;

  const [[current], [previous], byDay, links, referrers, countries, cities, devices, recentViews] = await Promise.all([
    views().where(inRange),
    views().where(inPrevious),
    db
      .select({ day, views: count() })
      .from(linkViews)
      .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id))
      .where(inRange)
      .groupBy(sql`1`),
    db
      .select({
        id: shareLinks.id,
        slug: shareLinks.slug,
        resumeId: shareLinks.resumeId,
        resumeTitle: resumes.title,
        views: sql<number>`count(${linkViews.id})`.mapWith(Number),
        totalViews: shareLinks.viewCount,
        lastViewedAt: shareLinks.lastViewedAt,
      })
      .from(shareLinks)
      .innerJoin(resumes, eq(shareLinks.resumeId, resumes.id))
      .leftJoin(linkViews, and(eq(linkViews.shareLinkId, shareLinks.id), gte(linkViews.viewedAt, since)))
      .where(ownLinks)
      .groupBy(shareLinks.id, resumes.title)
      .orderBy(sql`5 desc`, desc(shareLinks.lastViewedAt)),
    breakdown(linkViews.referrer, "direct"),
    breakdown(linkViews.country, "unknown"),
    // "Pune, Maharashtra": the region tells apart cities that share a name.
    breakdown(sql`nullif(concat_ws(', ', ${linkViews.city}, ${linkViews.region}), '')`, "unknown"),
    breakdown(linkViews.device, "unknown"),
    db
      .select({
        id: linkViews.id,
        viewedAt: linkViews.viewedAt,
        shareLinkId: shareLinks.id,
        slug: shareLinks.slug,
        resumeTitle: resumes.title,
        referrer: linkViews.referrer,
        country: linkViews.country,
        device: linkViews.device,
      })
      .from(linkViews)
      .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id))
      .innerJoin(resumes, eq(shareLinks.resumeId, resumes.id))
      .where(ownLinks)
      .orderBy(desc(linkViews.viewedAt))
      .limit(15),
  ]);

  const viewsOn = new Map(byDay.map((row) => [row.day, row.views]));
  return {
    days,
    totals: {
      views: current?.views ?? 0,
      uniqueVisitors: current?.unique ?? 0,
      previousViews: previous?.views ?? 0,
      previousUniqueVisitors: previous?.unique ?? 0,
    },
    viewsByDay: dayKeys(days, timeZone, now).map((key) => ({ day: key, views: viewsOn.get(key) ?? 0 })),
    links,
    referrers,
    countries,
    cities,
    devices,
    recentViews,
  };
}

type HourCount = { weekday: number; hour: number; views: number };
type LinkDayCount = { linkId: string; day: string; views: number };
type LinkTotal = { linkId: string; views: number; repeatOpens: number; topSource: string };

// Fills the gaps SQL leaves out: empty hours of the week and days a link had no views.
export function shapeInsights(keys: string[], hours: HourCount[], linkDays: LinkDayCount[], linkTotals: LinkTotal[]) {
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  // ISO weekday: 1 is Monday.
  for (const { weekday, hour, views } of hours) heatmap[weekday - 1]![hour]! += views;
  const links = linkTotals.map(({ linkId, ...totals }) => {
    const byDay = new Map(linkDays.filter((row) => row.linkId === linkId).map((row) => [row.day, row.views]));
    return { id: linkId, ...totals, viewsByDay: keys.map((day) => ({ day, views: byDay.get(day) ?? 0 })) };
  });
  return { heatmap, links };
}

export async function getInsights(userId: string, days: number, timeZone: string) {
  const now = new Date();
  const inRange = and(
    eq(shareLinks.userId, userId),
    isNull(shareLinks.deletedAt),
    gte(linkViews.viewedAt, new Date(now.getTime() - days * DAY_MS)),
  );
  const local = sql`${linkViews.viewedAt} at time zone ${timeZone}`;

  const [hours, linkDays, linkTotals] = await Promise.all([
    db
      .select({
        weekday: sql<number>`extract(isodow from ${local})::int`,
        hour: sql<number>`extract(hour from ${local})::int`,
        views: count(),
      })
      .from(linkViews)
      .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id))
      .where(inRange)
      .groupBy(sql`1`, sql`2`),
    db
      .select({ linkId: linkViews.shareLinkId, day: sql<string>`to_char(${local}, 'YYYY-MM-DD')`, views: count() })
      .from(linkViews)
      .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id))
      .where(inRange)
      .groupBy(sql`1`, sql`2`),
    db
      .select({
        linkId: linkViews.shareLinkId,
        views: count(),
        repeatOpens: sql<number>`count(${linkViews.visitorHash}) - count(distinct ${linkViews.visitorHash})`.mapWith(
          Number,
        ),
        topSource: sql<string>`mode() within group (order by coalesce(${linkViews.referrer}, 'direct'))`,
      })
      .from(linkViews)
      .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id))
      .where(inRange)
      .groupBy(linkViews.shareLinkId)
      .orderBy(desc(count())),
  ]);

  return { days, ...shapeInsights(dayKeys(days, timeZone, now), hours, linkDays, linkTotals) };
}

// ponytail: capped at 5000 rows, plenty for one person's links over 90 days; page it if that ever binds.
export async function exportViews(userId: string, days: number) {
  return db
    .select({
      viewedAt: linkViews.viewedAt,
      resumeTitle: resumes.title,
      slug: shareLinks.slug,
      referrer: linkViews.referrer,
      country: linkViews.country,
      region: linkViews.region,
      city: linkViews.city,
      device: linkViews.device,
    })
    .from(linkViews)
    .innerJoin(shareLinks, eq(linkViews.shareLinkId, shareLinks.id))
    .innerJoin(resumes, eq(shareLinks.resumeId, resumes.id))
    .where(
      and(
        eq(shareLinks.userId, userId),
        isNull(shareLinks.deletedAt),
        gte(linkViews.viewedAt, new Date(Date.now() - days * DAY_MS)),
      ),
    )
    .orderBy(desc(linkViews.viewedAt))
    .limit(5000);
}
