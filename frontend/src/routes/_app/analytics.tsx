import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Share2Icon } from 'lucide-react'
import { z } from 'zod'
import { BreakdownList } from '@/components/analytics/breakdown-list'
import { Change } from '@/components/analytics/change'
import { PremiumInsights } from '@/components/analytics/insights'
import {
  cityLabel,
  countryLabel,
  deviceLabel,
  referrerLabel,
} from '@/components/analytics/labels'
import { ViewsChart } from '@/components/analytics/views-chart'
import { PageHeader } from '@/components/app/page-header'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { errorMessage } from '@/lib/api/client'
import { analyticsQuery, meQuery } from '@/lib/api/queries'
import type { Analytics } from '@/lib/api/types'
import { timeAgo } from '@/lib/format'
import { site } from '@/lib/site'

const ranges = [7, 30, 90] as const
type Range = (typeof ranges)[number]

export const Route = createFileRoute('/_app/analytics')({
  validateSearch: z.object({
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
  }),
  head: () => ({ meta: [{ title: `Analytics | ${site.name}` }] }),
  loaderDeps: ({ search }) => ({ days: search.days ?? 30 }),
  // Changing the search in place shows the page's loading state instead of holding the old page.
  loader: ({ context, deps, cause }) =>
    cause === 'stay'
      ? undefined
      : context.queryClient.prefetchQuery(analyticsQuery(deps.days)),
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const { days = 30 } = Route.useSearch()
  const navigate = Route.useNavigate()
  const analytics = useQuery(analyticsQuery(days))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-8 sm:px-8">
      <PageHeader
        title="Analytics"
        description="Who opened the resumes you shared, and where they came from."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            value={String(days)}
            onValueChange={(value) =>
              value &&
              navigate({
                search: { days: Number(value) as Range },
                replace: true,
              })
            }
            aria-label="Time range"
          >
            {ranges.map((range) => (
              <ToggleGroupItem key={range} value={String(range)}>
                {range} days
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      {analytics.isPending ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-56" />
        </div>
      ) : analytics.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load analytics</AlertTitle>
          <AlertDescription>{errorMessage(analytics.error)}</AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => analytics.refetch()}
            >
              Try again
            </Button>
          </AlertAction>
        </Alert>
      ) : analytics.data.links.length === 0 ? (
        <NoLinks />
      ) : (
        <Report data={analytics.data} />
      )}
    </div>
  )
}

function NoLinks() {
  return (
    <div className="flex flex-col items-start gap-4 border-t pt-10">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Share2Icon className="size-5" />
      </span>
      <div className="flex max-w-lg flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Share a resume to see who opens it
        </h2>
        <p className="text-muted-foreground">
          Open a resume and choose Share to create a link. Every time someone
          opens it, you'll see it here: when, how often, and where they came
          from.
        </p>
      </div>
      <Button asChild>
        <Link to="/workspace">Go to your resumes</Link>
      </Button>
    </div>
  )
}

function Report({ data }: { data: Analytics }) {
  const { data: me } = useQuery(meQuery)
  const topLink = data.links[0]

  return (
    <>
      <dl className="grid gap-6 border-y py-6 sm:grid-cols-3 sm:divide-x">
        <div className="flex flex-col gap-1 sm:pr-6">
          <dt className="text-sm text-muted-foreground">Views</dt>
          <dd className="font-serif text-4xl tabular-nums">
            {data.totals.views.toLocaleString('en-IN')}
          </dd>
          <dd>
            <Change
              current={data.totals.views}
              previous={data.totals.previousViews}
            />
          </dd>
        </div>
        <div className="flex flex-col gap-1 sm:px-6">
          <dt className="text-sm text-muted-foreground">Unique visitors</dt>
          <dd className="font-serif text-4xl tabular-nums">
            {data.totals.uniqueVisitors.toLocaleString('en-IN')}
          </dd>
          <dd>
            <Change
              current={data.totals.uniqueVisitors}
              previous={data.totals.previousUniqueVisitors}
            />
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1 sm:pl-6">
          <dt className="text-sm text-muted-foreground">Most opened</dt>
          {topLink.views > 0 ? (
            <>
              <dd className="truncate font-serif text-2xl leading-tight">
                {topLink.resumeTitle}
              </dd>
              <dd className="text-sm text-muted-foreground">
                {topLink.views} {topLink.views === 1 ? 'view' : 'views'} in{' '}
                {data.days} days
              </dd>
            </>
          ) : (
            <dd className="text-sm text-muted-foreground">
              No views in this period
            </dd>
          )}
        </div>
      </dl>

      <section aria-labelledby="per-day" className="flex flex-col gap-4">
        <h2 id="per-day" className="font-sans text-base font-semibold">
          Views per day
        </h2>
        <ViewsChart data={data.viewsByDay} />
      </section>

      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <BreakdownList
          title="Where they came from"
          rows={data.referrers}
          label={referrerLabel}
        />
        <BreakdownList
          title="Countries"
          rows={data.countries}
          label={countryLabel}
        />
        <BreakdownList title="Cities" rows={data.cities} label={cityLabel} />
        <BreakdownList
          title="Devices"
          rows={data.devices}
          label={deviceLabel}
        />
      </div>

      <section aria-labelledby="links" className="flex flex-col gap-4">
        <h2 id="links" className="font-sans text-base font-semibold">
          Your links
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resume</TableHead>
                <TableHead className="text-right">
                  Last {data.days} days
                </TableHead>
                <TableHead className="text-right">All time</TableHead>
                <TableHead className="text-right">Last opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="max-w-72">
                    <Link
                      to="/resumes/$resumeId"
                      params={{ resumeId: link.resumeId }}
                      className="block truncate font-medium hover:underline"
                    >
                      {link.resumeTitle}
                    </Link>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {site.displayDomain}/{me?.username ?? '…'}/{link.slug}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {link.views.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {link.totalViews.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {link.lastViewedAt ? timeAgo(link.lastViewedAt) : 'Never'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="recent" className="flex flex-col gap-4">
        <h2 id="recent" className="font-sans text-base font-semibold">
          Recent opens
        </h2>
        {data.recentViews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody has opened your links yet. Views from you while signed in
            aren't counted.
          </p>
        ) : (
          <ol className="flex flex-col divide-y rounded-lg border">
            {data.recentViews.map((view) => (
              <li
                key={view.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
              >
                <p className="min-w-0">
                  <span className="text-muted-foreground">Someone opened </span>
                  <span className="font-medium">{view.resumeTitle}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    {view.referrer && view.referrer !== 'direct'
                      ? `via ${referrerLabel(view.referrer)}`
                      : 'directly'}
                    {view.country && ` · ${countryLabel(view.country)}`}
                    {view.device && ` · ${view.device}`}
                  </span>
                </p>
                <time
                  dateTime={new Date(view.viewedAt).toISOString()}
                  className="shrink-0 text-muted-foreground"
                >
                  {timeAgo(view.viewedAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <PremiumInsights days={data.days as Range} links={data.links} />
    </>
  )
}
