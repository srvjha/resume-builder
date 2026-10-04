import { env } from "../../config/env.js";
import { dayKeys } from "../analytics/analytics.service.js";

const configured = () => Boolean(env.POSTHOG_PERSONAL_API_KEY && env.POSTHOG_PROJECT_ID);

// PostHog caps how many queries a project runs at once and answers the rest with 503 "too busy",
// so requests queue here and a busy answer is retried after a pause.
const MAX_CONCURRENT = 3;
let running = 0;
const waiting: (() => void)[] = [];

export async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await run();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const busy = (status: number) => status === 429 || status === 503;

async function posthog<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await withSlot(() =>
      fetch(`${env.POSTHOG_APP_HOST}/api/projects/${env.POSTHOG_PROJECT_ID}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20_000),
      }),
    );
    if (!busy(res.status) || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(`PostHog ${res.status}: ${body?.detail ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

// Values are passed as HogQL placeholders, never interpolated into the query text.
async function hogql(query: string, values: Record<string, string | number>) {
  const data = await posthog<{ results: unknown[][] }>("/query/", {
    method: "POST",
    body: JSON.stringify({ query: { kind: "HogQLQuery", query, values }, name: "shortlist-admin" }),
  });
  return data.results;
}

const num = (value: unknown) => Number(value ?? 0);
const str = (value: unknown, fallback: string) => (value === null || value === "" ? fallback : String(value));
const rows = (results: unknown[][]) =>
  results.map(([label, count]) => ({ label: str(label, "unknown"), count: num(count) }));

async function traffic(days: number, timeZone: string) {
  const values = { days, timeZone };
  const pageviews = `event = '$pageview' AND timestamp >= now() - toIntervalDay({days})`;
  const breakdown = (expression: string) =>
    hogql(
      `SELECT ${expression} AS label, count() AS views FROM events WHERE ${pageviews}
       GROUP BY label ORDER BY views DESC LIMIT 8`,
      values,
    ).then(rows);

  const [
    totals,
    byDay,
    pages,
    referrers,
    countries,
    devices,
    browsers,
    events,
    api,
    recordings,
    compiles,
    previews,
    campaigns,
  ] = await Promise.all([
    hogql(
      `SELECT
         countIf(timestamp >= now() - toIntervalDay({days})),
         count(DISTINCT if(timestamp >= now() - toIntervalDay({days}), person_id, NULL)),
         count(DISTINCT if(timestamp >= now() - toIntervalDay({days}), $session_id, NULL)),
         countIf(timestamp < now() - toIntervalDay({days})),
         count(DISTINCT if(timestamp < now() - toIntervalDay({days}), person_id, NULL))
       FROM events
       WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay({days} * 2)`,
      values,
    ),
    hogql(
      `SELECT toString(toDate(toTimeZone(timestamp, {timeZone}))) AS day, count(), count(DISTINCT person_id)
       FROM events WHERE ${pageviews} GROUP BY day ORDER BY day`,
      values,
    ),
    breakdown("properties.$pathname"),
    breakdown("properties.$referring_domain"),
    breakdown("properties.$geoip_country_name"),
    breakdown("properties.$device_type"),
    breakdown("properties.$browser"),
    hogql(
      `SELECT event, count() AS total, count(DISTINCT person_id)
       FROM events
       WHERE timestamp >= now() - toIntervalDay({days}) AND NOT startsWith(event, '$') AND event != 'api_request'
       GROUP BY event ORDER BY total DESC LIMIT 20`,
      values,
    ),
    // api_request is sampled (see request-metrics.ts): slow and failed requests are always kept, fast ones 1 in 10.
    // Each event is repeated 1 / sample_rate times so counts and percentiles reflect real traffic (HogQL has no
    // weighted quantile); unweighted, the p95 read 30 times too high.
    hogql(
      `SELECT route, count() AS requests, quantile(0.5)(duration), quantile(0.95)(duration), countIf(status >= 500)
       FROM (
         SELECT
           concat(toString(properties.method), ' ', toString(properties.route)) AS route,
           toFloat(properties.duration_ms) AS duration,
           toInt(properties.status) AS status,
           arrayJoin(range(toInt(round(1 / toFloat(properties.sample_rate))))) AS copy
         FROM events
         WHERE event = 'api_request' AND timestamp >= now() - toIntervalDay({days})
       )
       GROUP BY route ORDER BY requests DESC LIMIT 15`,
      values,
    ),
    posthog<{
      results: {
        id: string;
        distinct_id: string;
        start_time: string;
        recording_duration: number;
        click_count: number;
        start_url: string | null;
      }[];
    }>("/session_recordings/?limit=10"),
    // PDF compiles, from the steps request-metrics.ts records; weighted like the API table above.
    hogql(
      `SELECT count(), countIf(cached), quantileIf(0.5)(compile, NOT cached), quantileIf(0.95)(compile, NOT cached),
         quantile(0.5)(lookup)
       FROM (
         SELECT
           toString(properties.compile_cached) = 'true' AS cached,
           toFloat(properties.compile_ms) AS compile,
           toFloat(properties.cache_lookup_ms) AS lookup,
           arrayJoin(range(toInt(round(1 / toFloat(properties.sample_rate))))) AS copy
         FROM events
         WHERE event = 'api_request' AND properties.compile_cached IS NOT NULL
           AND timestamp >= now() - toIntervalDay({days})
       )`,
      values,
    ),
    // Sent by the browser: from an edit to the new PDF on screen, including the debounce.
    hogql(
      `SELECT quantile(0.5)(toFloat(properties.duration_ms)), quantile(0.95)(toFloat(properties.duration_ms))
         FROM events WHERE event = 'preview_shown' AND timestamp >= now() - toIntervalDay({days})`,
      values,
    ),
    // Tagged links (?utm_source=…&utm_campaign=…), credited to each visitor's first tagged visit in the range.
    // A sign-up counts when that same person signed up in the range.
    hogql(
      `SELECT source, campaign, count() AS visitors,
           countIf(person_id IN (
             SELECT DISTINCT person_id FROM events
             WHERE event = 'user_signed_up' AND timestamp >= now() - toIntervalDay({days})
           )) AS signups
         FROM (
           SELECT person_id,
             argMin(toString(properties.$utm_source), timestamp) AS source,
             argMin(coalesce(toString(properties.$utm_campaign), ''), timestamp) AS campaign
           FROM events
           WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay({days})
             AND properties.$utm_source IS NOT NULL AND toString(properties.$utm_source) != ''
           GROUP BY person_id
         )
         GROUP BY source, campaign ORDER BY visitors DESC LIMIT 12`,
      values,
    ),
  ]);

  const [current = []] = totals;
  return {
    totals: {
      pageviews: num(current[0]),
      visitors: num(current[1]),
      sessions: num(current[2]),
      previousPageviews: num(current[3]),
      previousVisitors: num(current[4]),
    },
    byDay: (() => {
      // PostHog returns only days with page views; the chart needs every day in the range.
      const found = new Map(
        byDay.map(([day, views, visitors]) => [String(day), { views: num(views), visitors: num(visitors) }]),
      );
      return dayKeys(days, timeZone, new Date()).map((day) => ({
        day,
        ...(found.get(day) ?? { views: 0, visitors: 0 }),
      }));
    })(),
    pages,
    referrers,
    campaigns: campaigns.map(([source, campaign, visitors, signups]) => ({
      source: str(source, "unknown"),
      campaign: str(campaign, ""),
      visitors: num(visitors),
      signups: num(signups),
    })),
    countries,
    devices,
    browsers,
    events: events.map(([event, total, people]) => ({ event: String(event), count: num(total), people: num(people) })),
    api: api.map(([route, requests, p50, p95, errors]) => ({
      route: String(route),
      requests: num(requests),
      p50Ms: Math.round(num(p50)),
      p95Ms: Math.round(num(p95)),
      errors: num(errors),
    })),
    compiles: (([total, cached, p50, p95, lookup] = []) => ({
      requests: num(total),
      cacheHitRate: num(total) ? num(cached) / num(total) : 0,
      compileP50Ms: Math.round(num(p50)),
      compileP95Ms: Math.round(num(p95)),
      lookupP50Ms: Math.round(num(lookup)),
      seenP50Ms: Math.round(num(previews[0]?.[0])),
      seenP95Ms: Math.round(num(previews[0]?.[1])),
    }))(compiles[0]),
    recordings: recordings.results.map((recording) => ({
      id: recording.id,
      distinctId: recording.distinct_id,
      startedAt: new Date(recording.start_time),
      durationSeconds: Math.round(recording.recording_duration),
      clicks: recording.click_count,
      startUrl: recording.start_url,
      url: `${env.POSTHOG_APP_HOST}/project/${env.POSTHOG_PROJECT_ID}/replay/${recording.id}`,
    })),
  };
}

type Traffic = Awaited<ReturnType<typeof traffic>>;

// ponytail: per-process cache, fine for one API instance; PostHog rate-limits the query API, and each
// page load runs ten queries. Move to a shared cache if the API is ever scaled out.
const cache = new Map<string, { expires: number; data: Promise<Traffic> }>();
const TTL_MS = 5 * 60 * 1000;

export async function getTraffic(days: number, timeZone: string) {
  const dashboardUrl = `${env.POSTHOG_APP_HOST}/project/${env.POSTHOG_PROJECT_ID ?? ""}`;
  if (!configured()) return { configured: false as const, dashboardUrl, error: null, data: null };

  const key = `${days}:${timeZone}`;
  let entry = cache.get(key);
  if (!entry || entry.expires < Date.now()) {
    entry = { expires: Date.now() + TTL_MS, data: traffic(days, timeZone) };
    cache.set(key, entry);
  }
  try {
    return { configured: true as const, dashboardUrl, error: null, data: await entry.data };
  } catch (err) {
    cache.delete(key);
    return { configured: true as const, dashboardUrl, error: (err as Error).message, data: null };
  }
}
