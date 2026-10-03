import { diffWords, structuredPatch } from 'diff'
import type { ResumeContent } from './api/types'

export type Change =
  | { type: 'text'; where: string; before: string; after: string }
  | { type: 'items'; where: string; before: string[]; after: string[] }
  | { type: 'added' | 'removed'; where: string; text: string }
  | { type: 'hidden'; where: string; hidden: boolean }

type Item = { id: string; hidden?: boolean } & Record<string, unknown>

const fieldLabels: Record<string, string> = {
  start: 'Start date',
  end: 'End date',
  items: '',
  text: '',
}
// Not text: ids, visibility, AI masking flags, and children compared on their own.
const skipped = new Set([
  'id',
  'hidden',
  'sensitive',
  'type',
  'bullets',
  'entries',
  'groups',
])

// Links compare as "label url"; everything else as its string form.
const asText = (value: unknown): string => {
  if (value && typeof value === 'object' && 'url' in value) {
    const link = value as { label: string; url: string }
    return `${link.label} ${link.url}`
  }
  return String(value ?? '')
}

export function itemName(item: Record<string, unknown>) {
  return (
    [item.organization, item.institution, item.name, item.title, item.role]
      .map(asText)
      .find((value) => value.trim() !== '') ?? 'Entry'
  )
}

// Walks both contents by id, so pure reordering reports nothing.
export function diffContent(before: ResumeContent, after: ResumeContent) {
  const changes: Change[] = []

  const fields = (
    where: string[],
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ) => {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (skipped.has(key)) continue
      const label = [
        ...where,
        fieldLabels[key] ?? key[0].toUpperCase() + key.slice(1),
      ]
        .filter(Boolean)
        .join(', ')
      if (Array.isArray(a[key]) || Array.isArray(b[key])) {
        const oldItems = ((a[key] ?? []) as unknown[]).map(asText)
        const newItems = ((b[key] ?? []) as unknown[]).map(asText)
        if (oldItems.join('\n') !== newItems.join('\n'))
          changes.push({
            type: 'items',
            where: label,
            before: oldItems,
            after: newItems,
          })
      } else if (asText(a[key]) !== asText(b[key])) {
        changes.push({
          type: 'text',
          where: label,
          before: asText(a[key]),
          after: asText(b[key]),
        })
      }
    }
  }

  const children = (
    where: string[],
    a: unknown,
    b: unknown,
    name: (item: Item) => string,
    inner: (where: string[], a: Item, b: Item) => void,
  ) => {
    const oldItems = (a ?? []) as Item[]
    const newItems = (b ?? []) as Item[]
    const old = new Map(oldItems.map((item) => [item.id, item]))
    const ids = new Set(newItems.map((item) => item.id))
    const label = where.join(', ')
    for (const item of oldItems)
      if (!ids.has(item.id))
        changes.push({ type: 'removed', where: label, text: name(item) })
    for (const item of newItems) {
      const prev = old.get(item.id)
      if (!prev) {
        changes.push({ type: 'added', where: label, text: name(item) })
        continue
      }
      if (Boolean(prev.hidden) !== Boolean(item.hidden))
        changes.push({
          type: 'hidden',
          where: [...where, name(item)].join(', '),
          hidden: Boolean(item.hidden),
        })
      inner(where, prev, item)
    }
  }

  const bullet = (where: string[], a: Item, b: Item) => {
    if (a.text !== b.text)
      changes.push({
        type: 'text',
        where: where.join(', '),
        before: asText(a.text),
        after: asText(b.text),
      })
  }

  const entry = (where: string[], a: Item, b: Item) => {
    const path = [...where, itemName(b)]
    fields(path, a, b)
    children(
      [...path, 'Bullet'],
      a.bullets,
      b.bullets,
      (x) => asText(x.text),
      bullet,
    )
  }

  fields([], before.basics, after.basics)
  children(
    [],
    before.sections,
    after.sections,
    (section) => asText(section.title),
    (_, a, b) => {
      const path = [asText(b.title)]
      fields(path, a, b)
      children(
        path,
        a.groups,
        b.groups,
        (group) => asText(group.name),
        (where, ga, gb) => fields([...where, asText(gb.name)], ga, gb),
      )
      children(path, a.entries, b.entries, itemName, entry)
    },
  )
  return changes
}

export type HunkLine = { sign: '+' | '-' | ' '; text: string }

// Unified diff hunks with a few lines of context around each change.
export function lineHunks(before: string, after: string, context = 2) {
  return structuredPatch('', '', before, after, '', '', { context }).hunks.map(
    (hunk) => ({
      oldStart: hunk.oldStart,
      newStart: hunk.newStart,
      lines: hunk.lines
        .filter((line) => !line.startsWith('\\'))
        .map((line) => ({ sign: line[0], text: line.slice(1) }) as HunkLine),
    }),
  )
}

export type Run = { text: string; bold: boolean }

// Splits **bold** markers out of text, the same way the LaTeX and public pages read them.
export function richRuns(text: string): Run[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((run) => run.text)
}

// Word diff on the visible text, so bold markers never show up as changed words.
// Each part keeps the bold runs of the side it came from: before for removed, after otherwise.
export function richWordDiff(before: string, after: string) {
  const sides = [before, after].map((text) => {
    const runs = richRuns(text)
    return {
      plain: runs.map((run) => run.text).join(''),
      bold: runs.flatMap((run) => Array.from(run.text, () => run.bold)),
    }
  })
  const at = [0, 0]
  return diffWords(sides[0].plain, sides[1].plain).map((part) => {
    const side = part.removed ? 0 : 1
    const start = at[side]
    if (!part.added) at[0] += part.value.length
    if (!part.removed) at[1] += part.value.length
    const runs: Run[] = []
    Array.from(part.value).forEach((char, i) => {
      const bold = sides[side].bold[start + i] ?? false
      const last = runs.at(-1)
      if (last?.bold === bold) last.text += char
      else runs.push({ text: char, bold })
    })
    return { added: part.added, removed: part.removed, runs }
  })
}
