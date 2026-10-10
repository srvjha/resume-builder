import { ItemsDiff, LineDiff, WordDiff } from '@/components/diff'
import type { ResumeContent, SuggestionOperation } from '@/lib/api/types'
import { cn } from '@/lib/utils'

type Entry = { id: string; bullets?: { id: string; text: string }[] } & Record<
  string,
  unknown
>

function allEntries(content: ResumeContent) {
  return content.sections.flatMap((section) =>
    'entries' in section
      ? (section.entries as Entry[]).map((entry) => ({ section, entry }))
      : [],
  )
}

function findBulletText(content: ResumeContent, bulletId: string) {
  for (const { entry } of allEntries(content)) {
    const bullet = entry.bullets?.find((b) => b.id === bulletId)
    if (bullet) return bullet.text
  }
  return undefined
}

function labelFor(content: ResumeContent, id: string): string {
  if (id === 'sections') return 'sections'
  const section = content.sections.find((s) => s.id === id)
  if (section) return `the ${section.title} section`
  for (const { entry } of allEntries(content)) {
    if (entry.id === id) {
      const name = [
        entry.organization,
        entry.institution,
        entry.name,
        entry.title,
        entry.role,
      ].find(
        (value): value is string =>
          typeof value === 'string' && value.trim() !== '',
      )
      return name ?? 'an entry'
    }
    const bullet = entry.bullets?.find((b) => b.id === id)
    if (bullet)
      return `“${bullet.text.slice(0, 80)}${bullet.text.length > 80 ? '…' : ''}”`
  }
  const group = content.sections
    .flatMap((s) => (s.type === 'skills' ? s.groups : []))
    .find((g) => g.id === id)
  if (group) return `${group.name} skills`
  return 'an item'
}

// Shows **bold** markers as bold so reviewers see what the resume will look like.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\*\*(.+?)\*\*/g)
        .map((part, index) =>
          index % 2 === 1 ? <b key={index}>{part}</b> : part,
        )}
    </>
  )
}

export function OperationTitle({
  op,
  content,
}: {
  op: SuggestionOperation
  content: ResumeContent | null
}) {
  switch (op.type) {
    case 'update_bullet':
      return <>Rewrite bullet</>
    case 'add_bullet':
      return <>Add bullet</>
    case 'update_headline':
      return <>Change headline</>
    case 'set_hidden':
      return (
        <>
          {op.hidden ? 'Hide' : 'Show'}{' '}
          {content && op.targetId ? labelFor(content, op.targetId) : 'item'}
        </>
      )
    case 'reorder':
      return (
        <>
          Reorder{' '}
          {content && op.parentId ? labelFor(content, op.parentId) : 'items'}
        </>
      )
    case 'update_skills':
      return (
        <>
          Update{' '}
          {content && op.groupId ? labelFor(content, op.groupId) : 'skills'}
        </>
      )
    case 'replace_source':
      return <>Update the LaTeX</>
  }
}

function childIds(content: ResumeContent, parentId: string) {
  if (parentId === 'sections') return content.sections.map((s) => s.id)
  const section = content.sections.find((s) => s.id === parentId)
  if (section?.type === 'skills') return section.groups.map((g) => g.id)
  if (section && 'entries' in section)
    return (section.entries as Entry[]).map((e) => e.id)
  const entry = allEntries(content).find((e) => e.entry.id === parentId)
  return entry?.entry.bullets?.map((b) => b.id) ?? []
}

function findSkillItems(content: ResumeContent, groupId: string) {
  return content.sections
    .flatMap((s) => (s.type === 'skills' ? s.groups : []))
    .find((g) => g.id === groupId)?.items
}

export function OperationBody({
  op,
  content,
  texSource,
}: {
  op: SuggestionOperation
  content: ResumeContent | null
  texSource: string | null
}) {
  if (op.type === 'update_bullet' && op.text) {
    const before =
      content && op.bulletId ? findBulletText(content, op.bulletId) : undefined
    return <WordDiff before={before ?? ''} after={op.text} />
  }
  if (op.type === 'add_bullet' && op.text) {
    return <WordDiff before="" after={op.text} />
  }
  if (op.type === 'update_headline' && op.text) {
    return <WordDiff before={content?.basics.headline ?? ''} after={op.text} />
  }
  if (op.type === 'set_hidden' && content && op.targetId) {
    const text = findBulletText(content, op.targetId)
    return text ? (
      <p
        className={cn(
          'text-sm break-words',
          op.hidden && 'text-muted-foreground line-through',
        )}
      >
        <Rich text={text} />
      </p>
    ) : null
  }
  if (op.type === 'reorder' && op.orderedIds && content && op.parentId) {
    const old = childIds(content, op.parentId)
    return (
      <ol className="ml-5 list-decimal text-sm">
        {op.orderedIds.map((id, index) => {
          const was = old.indexOf(id)
          return (
            <li key={id}>
              {labelFor(content, id).replace(/^the /, '')}
              {was !== -1 && was !== index && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (was {was + 1})
                </span>
              )}
            </li>
          )
        })}
      </ol>
    )
  }
  if (op.type === 'update_skills' && op.items) {
    const before =
      content && op.groupId ? findSkillItems(content, op.groupId) : undefined
    return <ItemsDiff before={before ?? []} after={op.items} />
  }
  if (op.type === 'replace_source' && op.texSource && texSource !== null) {
    return <LineDiff before={texSource} after={op.texSource} />
  }
  return null
}
