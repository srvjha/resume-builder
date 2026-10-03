import { diffArrays } from 'diff'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ResumeContent } from '@/lib/api/types'
import { diffContent, lineHunks, richRuns, richWordDiff } from '@/lib/diff'
import type { Run } from '@/lib/diff'

const removedClass =
  'rounded-[2px] bg-destructive/10 px-0.5 text-destructive line-through decoration-destructive/70'
const addedClass =
  'rounded-[2px] bg-success/15 px-0.5 underline decoration-success decoration-2 underline-offset-2'

function Removed({ children }: { children: React.ReactNode }) {
  return (
    <del className={`box-decoration-clone ${removedClass}`}>
      <span className="sr-only">Removed: </span>
      {children}
    </del>
  )
}

function Added({ children }: { children: React.ReactNode }) {
  return (
    <ins className={`box-decoration-clone ${addedClass}`}>
      <span className="sr-only">Added: </span>
      {children}
    </ins>
  )
}

function Rich({ runs }: { runs: Run[] }) {
  return runs.map((run, index) =>
    run.bold ? <strong key={index}>{run.text}</strong> : run.text,
  )
}

export function WordDiff({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => richWordDiff(before, after), [before, after])
  return (
    <p className="text-sm break-words">
      {parts.map((part, index) =>
        part.removed ? (
          <Removed key={index}>
            <Rich runs={part.runs} />
          </Removed>
        ) : part.added ? (
          <Added key={index}>
            <Rich runs={part.runs} />
          </Added>
        ) : (
          <Rich key={index} runs={part.runs} />
        ),
      )}
    </p>
  )
}

export function ItemsDiff({
  before,
  after,
}: {
  before: string[]
  after: string[]
}) {
  const parts = useMemo(() => diffArrays(before, after), [before, after])
  return (
    <ul className="flex flex-wrap gap-1.5 text-sm">
      {parts.flatMap((part, index) =>
        part.value.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`} className="break-all">
            {part.removed ? (
              <Removed>{item}</Removed>
            ) : part.added ? (
              <Added>{item}</Added>
            ) : (
              <span className="px-0.5">{item}</span>
            )}
          </li>
        )),
      )}
    </ul>
  )
}

const collapsedLines = 40

export function LineDiff({ before, after }: { before: string; after: string }) {
  const hunks = useMemo(() => lineHunks(before, after), [before, after])
  const [expanded, setExpanded] = useState(false)
  if (hunks.length === 0)
    return <p className="text-sm text-muted-foreground">No changes.</p>

  let budget = expanded ? Infinity : collapsedLines
  const shown = hunks.filter((hunk) => {
    if (budget <= 0) return false
    budget -= hunk.lines.length
    return true
  })
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-96 overflow-auto rounded-md border bg-muted/50 font-mono text-xs leading-5">
        {shown.map((hunk) => (
          <div key={hunk.oldStart} className="border-b last:border-b-0">
            <div className="bg-muted px-2 text-muted-foreground">
              Line {hunk.newStart}
            </div>
            {hunk.lines.map((line, index) => (
              <div
                key={index}
                className={
                  line.sign === '+'
                    ? 'flex bg-success/15'
                    : line.sign === '-'
                      ? 'flex bg-destructive/10 text-destructive'
                      : 'flex'
                }
              >
                <span
                  aria-hidden
                  className="w-5 shrink-0 text-center text-muted-foreground select-none"
                >
                  {line.sign}
                </span>
                {line.sign !== ' ' && (
                  <span className="sr-only">
                    {line.sign === '+' ? 'Added line: ' : 'Removed line: '}
                  </span>
                )}
                <span className="pr-2 whitespace-pre">{line.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {shown.length < hunks.length && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setExpanded(true)}
        >
          Show {hunks.length - shown.length} more changed{' '}
          {hunks.length - shown.length === 1 ? 'part' : 'parts'}
        </Button>
      )}
    </div>
  )
}

export function ContentDiff({
  before,
  after,
}: {
  before: ResumeContent
  after: ResumeContent
}) {
  const changes = useMemo(() => diffContent(before, after), [before, after])
  if (changes.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No text changes. Only layout or order differ.
      </p>
    )
  return (
    <ul className="flex flex-col gap-3">
      {changes.map((change, index) => (
        <li key={index} className="flex flex-col gap-1">
          {change.where && (
            <span className="text-xs text-muted-foreground">
              {change.where}
            </span>
          )}
          {change.type === 'text' ? (
            <WordDiff before={change.before} after={change.after} />
          ) : change.type === 'items' ? (
            <ItemsDiff before={change.before} after={change.after} />
          ) : change.type === 'hidden' ? (
            <p className="text-sm">
              {change.hidden ? 'Hidden' : 'Shown again'}
            </p>
          ) : (
            <p className="text-sm break-words">
              {change.type === 'added' ? (
                <Added>
                  <Rich runs={richRuns(change.text)} />
                </Added>
              ) : (
                <Removed>
                  <Rich runs={richRuns(change.text)} />
                </Removed>
              )}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
