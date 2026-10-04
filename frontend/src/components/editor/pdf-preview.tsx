import { AlertTriangleIcon, FileWarningIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CompileError } from '@/hooks/use-pdf-preview'
import { PdfPages } from './pdf-pages'

export function PdfPreview({
  url,
  pageCount,
  pageLimit,
  errors,
  loading,
  failed,
  onErrorClick,
  onFix,
  fixes,
}: {
  url: string | null
  pageCount: number | null
  pageLimit: number
  errors: CompileError[] | null
  loading: boolean
  failed: string | null
  onErrorClick?: (line: number) => void
  onFix?: () => void
  // Quick ways back under the page limit; each is offered only when it applies.
  fixes?: {
    removeSpace?: () => void
    compact?: () => void
    allowPages?: (pages: number) => void
  }
}) {
  const over = pageCount !== null && pageCount > pageLimit
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-sm">
        <span className="font-medium">Preview</span>
        {pageCount !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={over ? 'destructive' : 'secondary'} tabIndex={0}>
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                {over && `, limit ${pageLimit}`}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {over
                ? `Longer than your ${pageLimit}-page limit. Recruiters skim, so trim it to fit.`
                : `Pages in the PDF. Your limit is ${pageLimit}.`}
            </TooltipContent>
          </Tooltip>
        )}
        {loading && (
          <span className="ml-auto flex items-center gap-2 text-muted-foreground">
            <Spinner />
            Updating…
          </span>
        )}
      </div>
      {over && fixes && (
        <Alert className="shrink-0 rounded-none border-x-0 border-t-0">
          <AlertTriangleIcon />
          <AlertTitle>
            {pageCount} pages, over your {pageLimit}-page limit
          </AlertTitle>
          <AlertDescription>
            <p>
              Recruiters skim, so one page reads best. Hide or shorten something
              you don't need, or:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {fixes.removeSpace && (
                <Button size="sm" variant="outline" onClick={fixes.removeSpace}>
                  Remove the space you added
                </Button>
              )}
              {fixes.compact && (
                <Button size="sm" variant="outline" onClick={fixes.compact}>
                  Use compact spacing
                </Button>
              )}
              {fixes.allowPages && pageCount <= 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fixes.allowPages?.(pageCount)}
                >
                  Allow {pageCount} pages (not recommended)
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {errors && errors.length > 0 && (
        <div className="shrink-0 border-b p-3">
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>The LaTeX doesn't compile</AlertTitle>
            <AlertDescription>
              <ul className="flex flex-col gap-1.5 break-words">
                {errors.slice(0, 4).map((error, index) => (
                  <li key={index}>
                    {error.line !== null && onErrorClick ? (
                      <button
                        type="button"
                        className="rounded-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => onErrorClick(error.line!)}
                      >
                        Line {error.line}
                      </button>
                    ) : null}
                    {error.line !== null && ': '}
                    {error.message}
                    {error.hint && (
                      <span className="block text-foreground/80">
                        {error.hint}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {onFix && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={onFix}
                >
                  Fix it with AI
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-muted/60">
        {url ? (
          <div className="size-full overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-8">
              <PdfPages url={url} />
            </div>
          </div>
        ) : failed ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <FileWarningIcon className="size-6" />
            <p>{failed}</p>
          </div>
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Spinner />
          </div>
        )}
      </div>
    </div>
  )
}
