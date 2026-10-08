import { SlidersHorizontalIcon } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ResumeDetail } from '@/lib/api/types'
import { cn } from '@/lib/utils'

export type ResumeLayout = ResumeDetail['layout']

const spacings = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxed' },
] as const

const linkStyles = [
  { value: 'icon-and-link', label: 'Icon + link' },
  { value: 'icon-and-name', label: 'Icon + name' },
  { value: 'link', label: 'Link only' },
] as const

export function LayoutMenu({
  value,
  templateFontSize,
  onChange,
}: {
  value: ResumeLayout
  templateFontSize: number
  onChange: (layout: ResumeLayout) => void
}) {
  const id = useId()
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" className="hidden md:inline-flex">
              <SlidersHorizontalIcon data-icon="inline-start" />
              Layout
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Spacing, font size and links of this resume
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="flex w-72 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span id={`${id}-spacing`} className="text-sm font-medium">
            Spacing
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={value.spacing}
            onValueChange={(spacing) =>
              spacing &&
              onChange({
                ...value,
                spacing: spacing as ResumeLayout['spacing'],
              })
            }
            aria-labelledby={`${id}-spacing`}
            className="w-full"
          >
            {spacings.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="flex-1"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            Line height and the gaps between the name, sections and bullets.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span id={`${id}-size`} className="text-sm font-medium">
            Font size
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={String(value.fontSize ?? templateFontSize)}
            onValueChange={(size) =>
              size &&
              onChange({
                ...value,
                fontSize: Number(size) as ResumeLayout['fontSize'],
              })
            }
            aria-labelledby={`${id}-size`}
            className="w-full"
          >
            {[10, 11, 12].map((size) => (
              <ToggleGroupItem
                key={size}
                value={String(size)}
                className="flex-1"
              >
                {size}pt
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            This template uses {templateFontSize}pt unless you pick another
            size.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span id={`${id}-links`} className="text-sm font-medium">
            Profile links
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={value.links ?? 'icon-and-link'}
            onValueChange={(links) =>
              links &&
              onChange({ ...value, links: links as ResumeLayout['links'] })
            }
            aria-labelledby={`${id}-links`}
            className="w-full"
          >
            {linkStyles.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="flex-1 px-1.5 text-xs"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p
            className={cn(
              'text-xs',
              value.links === 'icon-and-name'
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {value.links === 'icon-and-name'
              ? 'Shows the link\'s name, like "LinkedIn", instead of its address. ATS software and printed copies only see that name, so use it for resumes you send as a PDF to click.'
              : 'LinkedIn, GitHub, Instagram and website links in your header. Email and phone always stay as text.'}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
