import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Link } from './content-helpers'
import { move } from './content-helpers'
import { SensitiveToggle } from './fields'

export function LinksEditor({
  links,
  onChange,
  idPrefix,
  labelPlaceholder = 'GitHub',
  urlPlaceholder = 'https://github.com/you',
}: {
  links: Link[]
  onChange: (links: Link[]) => void
  idPrefix: string
  labelPlaceholder?: string
  urlPlaceholder?: string
}) {
  const update = (index: number, patch: Partial<Link>) =>
    onChange(
      links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    )

  return (
    <div className="flex flex-col gap-2">
      {links.map((link, index) => (
        <div
          key={index}
          className={cn(
            'grid items-end gap-2',
            links.length > 1
              ? 'grid-cols-[1fr_2fr_auto_auto_auto]'
              : 'grid-cols-[1fr_2fr_auto_auto]',
          )}
        >
          <Field>
            <FieldLabel
              htmlFor={`${idPrefix}-label-${index}`}
              className={cn(index > 0 && 'sr-only')}
            >
              Label
            </FieldLabel>
            <Input
              id={`${idPrefix}-label-${index}`}
              value={link.label}
              placeholder={labelPlaceholder}
              onChange={(event) => update(index, { label: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel
              htmlFor={`${idPrefix}-url-${index}`}
              className={cn(index > 0 && 'sr-only')}
            >
              URL
            </FieldLabel>
            <Input
              id={`${idPrefix}-url-${index}`}
              type="url"
              value={link.url}
              placeholder={urlPlaceholder}
              onChange={(event) => update(index, { url: event.target.value })}
            />
          </Field>
          {links.length > 1 && (
            <div className="flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8"
                aria-label={`Move ${link.label || 'link'} up`}
                disabled={index === 0}
                onClick={() => onChange(move(links, index, -1))}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8"
                aria-label={`Move ${link.label || 'link'} down`}
                disabled={index === links.length - 1}
                onClick={() => onChange(move(links, index, 1))}
              >
                <ArrowDownIcon />
              </Button>
            </div>
          )}
          <SensitiveToggle
            label={`${link.label || 'link'} URL`}
            pressed={link.sensitive ?? false}
            onPressedChange={(sensitive) => update(index, { sensitive })}
            className="h-8 min-w-8"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${link.label || 'link'}`}
            onClick={() => onChange(links.filter((_, i) => i !== index))}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onChange([...links, { label: '', url: '' }])}
      >
        <PlusIcon data-icon="inline-start" />
        Add link
      </Button>
    </div>
  )
}
