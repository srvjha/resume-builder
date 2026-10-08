import type { ResumeContent, ResumeSection } from '@/lib/api/types'

export type SectionOf<T extends ResumeSection['type']> = Extract<
  ResumeSection,
  { type: T }
>
export type ExperienceEntry = SectionOf<'experience'>['entries'][number]
export type EducationEntry = SectionOf<'education'>['entries'][number]
export type ProjectEntry = SectionOf<'projects'>['entries'][number]
export type ListEntry = SectionOf<'list'>['entries'][number]
export type Bullet = ExperienceEntry['bullets'][number]
export type Link = ResumeContent['basics']['links'][number]

export function newId() {
  return Math.random().toString(36).slice(2, 10)
}

export function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export const sectionPresets = [
  { type: 'summary', title: 'Summary' },
  { type: 'experience', title: 'Experience' },
  { type: 'education', title: 'Education' },
  { type: 'projects', title: 'Projects' },
  { type: 'skills', title: 'Technical Skills' },
  { type: 'list', title: 'Achievements' },
  { type: 'list', title: 'Positions of Responsibility' },
  { type: 'list', title: 'Certifications' },
  { type: 'links', title: 'Profile Links' },
] as const

export function createSection(
  type: ResumeSection['type'],
  title: string,
): ResumeSection {
  const base = { id: newId(), title, hidden: false }
  switch (type) {
    case 'skills':
      return {
        ...base,
        type,
        groups: [{ id: newId(), name: 'Languages', items: [] }],
      }
    case 'links':
      return { ...base, type, links: [] }
    case 'summary':
      return { ...base, type, text: '' }
    case 'experience':
      return { ...base, type, entries: [createEntry(type)] }
    case 'education':
      return { ...base, type, entries: [createEntry(type)] }
    case 'projects':
      return { ...base, type, entries: [createEntry(type)] }
    case 'list':
      return { ...base, type, entries: [createEntry(type)] }
  }
}

export function createEntry(type: 'experience'): ExperienceEntry
export function createEntry(type: 'education'): EducationEntry
export function createEntry(type: 'projects'): ProjectEntry
export function createEntry(type: 'list'): ListEntry
export function createEntry(
  type: 'experience' | 'education' | 'projects' | 'list',
): ExperienceEntry | EducationEntry | ProjectEntry | ListEntry {
  const base = { id: newId(), hidden: false, bullets: [] as Bullet[] }
  switch (type) {
    case 'experience':
      return { ...base, organization: '', role: '' }
    case 'education':
      return { ...base, institution: '' }
    case 'projects':
      return { ...base, name: '', technologies: [], links: [] }
    case 'list':
      return { ...base, title: '' }
  }
}

export function entryLabel(
  section: ResumeSection,
  entry: Record<string, unknown>,
) {
  const pick = (...keys: string[]) =>
    keys
      .map((key) => entry[key])
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim() !== '',
      )
      .join(', ')
  switch (section.type) {
    case 'experience':
      return pick('organization', 'role') || 'New role'
    case 'education':
      return pick('institution', 'degree') || 'New education'
    case 'projects':
      return pick('name') || 'New project'
    default:
      return pick('title', 'subtitle') || 'New item'
  }
}

// Ctrl+B or ⌘B wraps the selected words in ** (the bold marker the templates read), or unwraps them.
export function toggleBold(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  onChange: (text: string) => void,
) {
  if (event.key.toLowerCase() !== 'b' || !(event.metaKey || event.ctrlKey))
    return
  const field = event.currentTarget
  const { value } = field
  let start = field.selectionStart
  let end = field.selectionEnd
  // A double-click can take the space after a word; ** must hug the words.
  while (start < end && value[start] === ' ') start++
  while (end > start && value[end - 1] === ' ') end--
  if (start === end) return
  event.preventDefault()
  const selected = value.slice(start, end)
  const around =
    value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**'
  const inside =
    selected.length > 4 && selected.startsWith('**') && selected.endsWith('**')
  const [text, from, to] = around
    ? [
        value.slice(0, start - 2) + selected + value.slice(end + 2),
        start - 2,
        end - 2,
      ]
    : inside
      ? [
          value.slice(0, start) + selected.slice(2, -2) + value.slice(end),
          start,
          end - 4,
        ]
      : [
          value.slice(0, start) + `**${selected}**` + value.slice(end),
          start + 2,
          end + 2,
        ]
  onChange(text)
  requestAnimationFrame(() => field.setSelectionRange(from, to))
}
