import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { FieldDescription } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { fetchOpenRouterModels, filterAiModels } from '@/lib/openrouter-models'

export function AiModelInput({
  provider,
  modelIds,
  value,
  onValueChange,
  disabled,
  ...props
}: Omit<
  ComponentProps<typeof InputGroupInput>,
  'onChange' | 'value' | 'ref'
> & {
  provider: string
  modelIds: string[]
  value: string
  onValueChange: (value: string) => void
}) {
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const activeOption = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const { data, isPending, isError } = useQuery({
    queryKey: ['openrouter', 'models'],
    queryFn: ({ signal }) => fetchOpenRouterModels(signal),
    enabled: provider === 'openrouter',
    staleTime: 15 * 60 * 1000,
    retry: false,
  })
  const canSuggest = provider === 'openrouter' || modelIds.length > 1
  const models = filterAiModels(
    modelIds,
    provider === 'openrouter' ? (data ?? []) : [],
    searching ? value : '',
  )
  const activeIndex = models.findIndex((model) => model.id === activeId)
  const expanded = open && canSuggest && !disabled

  useEffect(() => {
    activeOption.current?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const selectModel = (id: string) => {
    onValueChange(id)
    setSearching(false)
    setOpen(false)
    setActiveId(null)
    input.current?.focus()
  }

  return (
    <>
      <Popover
        open={expanded}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setActiveId(null)
        }}
      >
        <PopoverAnchor asChild>
          <InputGroup ref={anchor}>
            <InputGroupInput
              {...props}
              ref={input}
              value={value}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              role={canSuggest ? 'combobox' : undefined}
              aria-autocomplete={canSuggest ? 'list' : undefined}
              aria-expanded={canSuggest ? expanded : undefined}
              aria-controls={expanded ? listId : undefined}
              aria-activedescendant={
                expanded && activeIndex >= 0
                  ? `${listId}-${activeIndex}`
                  : undefined
              }
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                onValueChange(event.target.value)
                setSearching(true)
                setActiveId(null)
                setOpen(true)
              }}
              onKeyDown={(event) => {
                if (!canSuggest || event.nativeEvent.isComposing) return
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setOpen(true)
                  const down = event.key === 'ArrowDown'
                  const next =
                    activeIndex < 0
                      ? down
                        ? 0
                        : models.length - 1
                      : activeIndex + (down ? 1 : -1)
                  setActiveId(
                    models[(next + models.length) % models.length]?.id ?? null,
                  )
                } else if (
                  event.key === 'Enter' &&
                  expanded &&
                  activeIndex >= 0
                ) {
                  event.preventDefault()
                  selectModel(models[activeIndex].id)
                } else if (event.key === 'Escape' && expanded) {
                  event.preventDefault()
                  event.stopPropagation()
                  setOpen(false)
                  setActiveId(null)
                } else if (event.key === 'Tab' || event.key === 'Enter') {
                  setOpen(false)
                  setActiveId(null)
                }
              }}
            />
            {canSuggest && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  disabled={disabled}
                  aria-label="Browse models"
                  aria-expanded={expanded}
                  aria-controls={expanded ? listId : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    input.current?.focus()
                    setSearching(false)
                    setActiveId(null)
                    setOpen(!expanded)
                  }}
                >
                  <ChevronsUpDownIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={6}
          role="presentation"
          className="w-(--radix-popover-trigger-width) gap-0 overflow-hidden p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchor.current?.contains(event.target as Node))
              event.preventDefault()
          }}
        >
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {provider === 'openrouter' ? 'OpenRouter models' : 'Saved models'}
            </span>
            <span role="status">
              {models.length} {models.length === 1 ? 'model' : 'models'}
            </span>
          </div>
          <Separator />
          <div
            id={listId}
            role="listbox"
            aria-label="AI models"
            className="max-h-[min(18rem,var(--radix-popover-content-available-height)-3rem)] overflow-y-auto overscroll-contain p-1"
          >
            {models.map((model, index) => (
              <Button
                key={model.id}
                id={`${listId}-${index}`}
                ref={index === activeIndex ? activeOption : undefined}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={value === model.id}
                variant={index === activeIndex ? 'secondary' : 'ghost'}
                className="h-auto min-h-12 w-full justify-between gap-3 px-3 py-2 text-left"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectModel(model.id)}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate">{model.name}</span>
                  {model.name !== model.id && (
                    <span className="truncate font-mono text-xs font-normal text-muted-foreground">
                      {model.id}
                    </span>
                  )}
                </span>
                {value === model.id && <CheckIcon data-icon="inline-end" />}
              </Button>
            ))}
          </div>
          {models.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {provider === 'openrouter' && isPending
                    ? 'Loading models…'
                    : 'No matching models'}
                </EmptyTitle>
                <EmptyDescription>
                  {provider === 'openrouter' && isPending
                    ? 'You can enter a model ID while the catalog loads.'
                    : 'Try another search or enter a model ID directly.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </PopoverContent>
      </Popover>
      {canSuggest && (
        <FieldDescription role="status">
          {provider === 'openrouter' && isError
            ? 'Catalog unavailable. Enter a model ID or choose a saved model.'
            : 'Search by name or ID, or enter a custom model ID.'}
        </FieldDescription>
      )}
    </>
  )
}
