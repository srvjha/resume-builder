import type { UseQueryResult } from '@tanstack/react-query'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Change } from '@/components/analytics/change'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/client'
import { formatNumber, percent, planLabels } from '@/lib/format'
import { templateCatalog } from '@/lib/templates'
import { cn } from '@/lib/utils'

// Loading, error and success states for one admin report.
export function QueryView<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>
  children: (data: T) => React.ReactNode
}) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load this report</AlertTitle>
        <AlertDescription>{errorMessage(query.error)}</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </AlertAction>
      </Alert>
    )
  }
  return <>{children(query.data)}</>
}

export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border min-[420px]:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </dl>
  )
}

export function Stat({
  label,
  value,
  current,
  previous,
  format,
  hint,
}: {
  label: string
  value: React.ReactNode
  current?: number
  previous?: number
  format?: (value: number) => string
  hint?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-background p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate font-serif text-3xl tabular-nums">{value}</dd>
      {current !== undefined && previous !== undefined ? (
        <dd>
          <Change current={current} previous={previous} format={format} />
        </dd>
      ) : (
        hint && <dd className="text-sm text-muted-foreground">{hint}</dd>
      )}
    </div>
  )
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section
      aria-labelledby={id}
      className={cn('flex flex-col gap-4', className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="font-sans text-base font-semibold">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

// Each step as a share of the first, so drop-off between steps is visible.
export function Funnel({
  steps,
}: {
  steps: { label: string; count: number }[]
}) {
  const first = steps[0]?.count ?? 0
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={step.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>
              <span className="mr-2 text-muted-foreground tabular-nums">
                {index + 1}.
              </span>
              {step.label}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatNumber(step.count)}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {percent(step.count, first)}
              </span>
            </span>
          </div>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: first ? `${(step.count / first) * 100}%` : 0 }}
            />
          </span>
        </li>
      ))}
    </ol>
  )
}

export function PlanBadge({ plan }: { plan: keyof typeof planLabels }) {
  return (
    <Badge variant={plan === 'free' ? 'secondary' : 'default'}>
      {planLabels[plan]}
    </Badge>
  )
}

const providerLabels: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  chatgpt: 'ChatGPT',
  anonymous: 'Guest',
}

// Some sign-ins arrive without a name.
export const displayName = (user: { name: string; email: string }) =>
  user.name.trim() || user.email

export const providerLabel = (id: string) => providerLabels[id] ?? id

const stepLabels: Record<string, string> = {
  import: 'Import',
  jd_parse: 'Read job post',
  plan: 'Plan changes',
  rewrite: 'Tailor',
  verify: 'Check facts',
  inline_edit: 'Inline edit',
  chat_edit: 'Chat edit',
  fix_compile: 'Fix LaTeX',
  draft: 'Write from notes',
}

export const stepLabel = (step: string) => stepLabels[step] ?? step

export const templateName = (id: string) =>
  templateCatalog.find((template) => template.id === id)?.name ?? id

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

// An email with a copy button. relative z-10 lifts the button above a row-wide link overlay.
export function CopyEmail({
  email,
  className,
}: {
  email: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      <span className="truncate">{email}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="relative z-10 shrink-0"
        aria-label={`Copy ${email}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            toast.error('Could not copy. Select the email instead.')
          }
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </span>
  )
}
