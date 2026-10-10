import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleDollarSignIcon,
  EyeIcon,
  FileTextIcon,
  IndianRupeeIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  EmptyNote,
  Funnel,
  PlanBadge,
  QueryView,
  Section,
  providerLabel,
  displayName,
} from '@/components/admin/admin-ui'
import { BreakdownList } from '@/components/analytics/breakdown-list'
import { ViewsChart } from '@/components/analytics/views-chart'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { adminOverviewQuery } from '@/lib/api/queries'
import type { AdminOverview } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import {
  formatInr,
  formatNumber,
  formatUsd,
  initials,
  percent,
  planLabels,
  timeAgo,
} from '@/lib/format'

export const Route = createFileRoute('/_app/admin/')({
  loaderDeps: ({ search }) => ({ days: search.days ?? 30 }),
  // Not awaited, so switching tabs or ranges shows the loading state at once instead of holding the old page.
  loader: ({ context, deps, cause }) =>
    cause === 'stay'
      ? undefined
      : void context.queryClient.prefetchQuery(adminOverviewQuery(deps.days)),
  component: OverviewPage,
})

function OverviewPage() {
  const { days = 30 } = Route.useSearch()
  const overview = useQuery(adminOverviewQuery(days))
  return (
    <QueryView query={overview}>{(data) => <Overview data={data} />}</QueryView>
  )
}

const metrics = [
  { key: 'signups', label: 'Sign-ups', unit: ['sign-up', 'sign-ups'] },
  { key: 'resumes', label: 'Resumes', unit: ['resume', 'resumes'] },
  { key: 'aiRuns', label: 'AI runs', unit: ['AI run', 'AI runs'] },
  { key: 'views', label: 'Share views', unit: ['view', 'views'] },
] as const

function Overview({ data }: { data: AdminOverview }) {
  const { totals } = data
  const [metric, setMetric] =
    useState<(typeof metrics)[number]['key']>('signups')
  const selected = metrics.find((m) => m.key === metric)!
  const series = (key: (typeof metrics)[number]['key']) =>
    data.byDay.map((day) => day[key])
  const selectedTotal = series(metric).reduce((sum, n) => sum + n, 0)

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-card px-5 py-4 sm:grid-cols-4">
        <Total label="People signed up" value={totals.users} />
        <Total label="Guests" value={totals.guests} />
        <Total label="On a paid plan" value={totals.paidUsers} />
        <Total label="Suspended" value={totals.suspendedUsers} />
      </dl>

      <KpiGroup title="Growth" days={data.days}>
        <Kpi
          icon={UserPlusIcon}
          label="New sign-ups"
          value={formatNumber(totals.newUsers)}
          current={totals.newUsers}
          previous={totals.previousNewUsers}
          trend={series('signups')}
        />
        <Kpi
          icon={UsersIcon}
          label="Active users"
          value={formatNumber(totals.activeUsers)}
          current={totals.activeUsers}
          previous={totals.previousActiveUsers}
          hint="Signed in during this range"
        />
        <Kpi
          icon={FileTextIcon}
          label="Resumes created"
          value={formatNumber(totals.resumesCreated)}
          current={totals.resumesCreated}
          previous={totals.previousResumesCreated}
          trend={series('resumes')}
        />
        <Kpi
          icon={EyeIcon}
          label="Share views"
          value={formatNumber(totals.shareViews)}
          current={totals.shareViews}
          previous={totals.previousShareViews}
          trend={series('views')}
        />
      </KpiGroup>

      <KpiGroup title="AI and revenue" days={data.days}>
        <Kpi
          icon={SparklesIcon}
          label="AI runs"
          value={formatNumber(totals.aiRuns)}
          current={totals.aiRuns}
          previous={totals.previousAiRuns}
          trend={series('aiRuns')}
        />
        <Kpi
          icon={TriangleAlertIcon}
          label="AI failure rate"
          value={percent(totals.aiFailed, totals.aiRuns)}
          hint={`${formatNumber(totals.aiFailed)} of ${formatNumber(totals.aiRuns)} runs failed`}
        />
        <Kpi
          icon={CircleDollarSignIcon}
          label="AI cost"
          value={formatUsd(totals.aiCostUsdMicros)}
          current={totals.aiCostUsdMicros}
          previous={totals.previousAiCostUsdMicros}
          lowerIsBetter
          hint="What the AI provider charged"
        />
        <Kpi
          icon={IndianRupeeIcon}
          label="Revenue"
          value={formatInr(totals.revenuePaise)}
          current={totals.revenuePaise}
          previous={totals.previousRevenuePaise}
          hint="Paid in this range, minus refunds"
        />
      </KpiGroup>

      <Section
        title={`${selected.label} per day`}
        description={`${formatNumber(selectedTotal)} ${selectedTotal === 1 ? selected.unit[0] : selected.unit[1]} in the last ${data.days} days`}
        className={panel}
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={metric}
            onValueChange={(value) =>
              value && setMetric(value as typeof metric)
            }
            aria-label="Metric"
            className="flex-wrap"
          >
            {metrics.map((m) => (
              <ToggleGroupItem key={m.key} value={m.key}>
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        <ViewsChart
          data={data.byDay.map((day) => ({ day: day.day, views: day[metric] }))}
          unit={[...selected.unit]}
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Activation"
          description={`Of the ${formatNumber(data.funnel.signedUp)} who signed up in the last ${data.days} days`}
          className={panel}
        >
          <Funnel
            steps={[
              { label: 'Signed up', count: data.funnel.signedUp },
              { label: 'Created a resume', count: data.funnel.createdResume },
              { label: 'Used AI', count: data.funnel.usedAi },
              { label: 'Shared a link', count: data.funnel.shared },
              { label: 'Paid', count: data.funnel.paid },
            ]}
          />
        </Section>
        <div className="flex flex-col gap-4">
          <div className={panel}>
            <BreakdownList
              title="Plans"
              rows={data.plans.map((row) => ({
                label:
                  (planLabels as Record<string, string>)[row.label] ??
                  row.label,
                views: row.count,
              }))}
              empty="No users yet"
            />
          </div>
          <div className={panel}>
            <BreakdownList
              title="Sign-in methods"
              rows={data.providers.map((row) => ({
                label: providerLabel(row.label),
                views: row.count,
              }))}
              empty="No users yet"
            />
          </div>
        </div>
      </div>

      <Section
        title="Latest sign-ups"
        actions={
          <Link
            to="/admin/users"
            className="text-sm font-medium text-primary hover:underline"
          >
            All users
          </Link>
        }
      >
        {data.recentSignups.length === 0 ? (
          <EmptyNote>Nobody has signed up yet.</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
            {data.recentSignups.map((user) => (
              <li key={user.id}>
                <Link
                  to="/admin/users/$userId"
                  params={{ userId: user.id }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <Avatar className="size-9">
                    {user.image && <AvatarImage src={user.image} alt="" />}
                    <AvatarFallback>
                      {initials(user.name || user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {displayName(user)}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {user.email}
                      {user.providers.length > 0 &&
                        ` · ${user.providers.map(providerLabel).join(', ')}`}
                    </span>
                  </span>
                  <PlanBadge plan={user.plan} />
                  <time
                    dateTime={new Date(user.createdAt).toISOString()}
                    className="hidden w-28 shrink-0 text-right text-sm text-muted-foreground sm:block"
                  >
                    {timeAgo(user.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

const panel = 'rounded-xl border bg-card p-5'

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {formatNumber(value)}
      </dd>
    </div>
  )
}

function KpiGroup({
  title,
  days,
  children,
}: {
  title: string
  days: number
  children: React.ReactNode
}) {
  const id = `kpi-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-sans text-base font-semibold">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">
          Last {days} days vs the {days} before
        </span>
      </div>
      <dl className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {children}
      </dl>
    </section>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  current,
  previous,
  lowerIsBetter,
  trend,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  current?: number
  previous?: number
  lowerIsBetter?: boolean
  trend?: number[]
  hint?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <dt className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </dt>
        {current !== undefined && previous !== undefined && (
          <dd>
            <Delta
              current={current}
              previous={previous}
              lowerIsBetter={lowerIsBetter}
            />
          </dd>
        )}
      </div>
      <dd className="truncate font-serif text-3xl tabular-nums">{value}</dd>
      {/* Same height with or without a trend, so cards in a row line up. */}
      <dd className="flex h-9 items-end">
        {trend && hasTrend(trend) ? (
          <Sparkline values={trend} />
        ) : (
          hint && <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </dd>
    </div>
  )
}

// Green when the move is good for the business, red when it is bad; the arrow carries the direction too.
function Delta({
  current,
  previous,
  lowerIsBetter,
}: {
  current: number
  previous: number
  lowerIsBetter?: boolean
}) {
  if (previous === 0)
    return (
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {current === 0 ? 'None yet' : 'No earlier data'}
      </span>
    )
  const change = Math.round(((current - previous) / previous) * 100)
  const good = lowerIsBetter ? change < 0 : change > 0
  const Icon = change >= 0 ? ArrowUpIcon : ArrowDownIcon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums',
        change === 0
          ? 'bg-muted text-muted-foreground'
          : good
            ? 'bg-success/15 text-success'
            : 'bg-destructive/10 text-destructive',
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{change >= 0 ? 'Up' : 'Down'}</span>
      {Math.abs(change)}%<span className="sr-only"> vs the period before</span>
    </span>
  )
}

// A trend needs a few days with activity; one bar on a flat line says nothing.
const hasTrend = (values: number[]) => values.filter((v) => v > 0).length >= 2

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values)
  const points = values.map(
    (v, i) =>
      `${((i / (values.length - 1)) * 100).toFixed(2)},${(34 - (v / max) * 30).toFixed(2)}`,
  )
  const line = `M${points.join(' L')}`
  return (
    <svg
      viewBox="0 0 100 36"
      preserveAspectRatio="none"
      aria-hidden
      className="h-9 w-full text-primary"
    >
      <path d={`${line} L100,36 L0,36 Z`} className="fill-primary/10" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
