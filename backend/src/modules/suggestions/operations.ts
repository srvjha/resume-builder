import { z } from "zod";
import type { ResumeContent } from "../../schemas/resume-content.js";

// Edits the AI may propose on structured content. None of them may add new facts: bullets are rephrased in place or
// split into a new bullet after an existing one (checked for unknown facts like a rewrite), and skills can only be
// reordered or trimmed.
export const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("update_bullet"), bulletId: z.string(), text: z.string() }),
  z.object({ type: z.literal("add_bullet"), afterBulletId: z.string(), text: z.string() }),
  z.object({ type: z.literal("update_headline"), text: z.string() }),
  z.object({ type: z.literal("set_hidden"), targetId: z.string(), hidden: z.boolean() }),
  // parentId is a section id (orders entries), an entry id (orders bullets) or "sections".
  z.object({ type: z.literal("reorder"), parentId: z.string(), orderedIds: z.array(z.string()) }),
  z.object({ type: z.literal("update_skills"), groupId: z.string(), items: z.array(z.string()) }),
  // Code-mode resumes: the whole revised LaTeX source.
  z.object({ type: z.literal("replace_source"), texSource: z.string() }),
]);

export type Operation = z.infer<typeof operationSchema> & { id: string; reason: string; flags: string[] };

type Entry = { id: string; hidden: boolean; bullets: { id: string; text: string; hidden: boolean }[] };

function entriesOf(section: ResumeContent["sections"][number]): Entry[] {
  return "entries" in section ? (section.entries as Entry[]) : [];
}

function findBullet(content: ResumeContent, bulletId: string) {
  return entryOfBullet(content, bulletId)?.bullets.find((b) => b.id === bulletId);
}

function entryOfBullet(content: ResumeContent, bulletId: string) {
  for (const section of content.sections) {
    for (const entry of entriesOf(section)) {
      if (entry.bullets.some((b) => b.id === bulletId)) return entry;
    }
  }
  return undefined;
}

function findSkillGroup(content: ResumeContent, groupId: string) {
  for (const section of content.sections) {
    if (section.type === "skills") {
      const group = section.groups.find((g) => g.id === groupId);
      if (group) return group;
    }
  }
  return undefined;
}

function childIds(content: ResumeContent, parentId: string): string[] | undefined {
  if (parentId === "sections") return content.sections.map((s) => s.id);
  for (const section of content.sections) {
    if (section.id === parentId) {
      if (section.type === "skills") return section.groups.map((g) => g.id);
      if (section.type === "links" || section.type === "summary") return undefined;
      return entriesOf(section).map((e) => e.id);
    }
    for (const entry of entriesOf(section)) {
      if (entry.id === parentId) return entry.bullets.map((b) => b.id);
    }
  }
  return undefined;
}

function hasTarget(content: ResumeContent, id: string) {
  return content.sections.some(
    (s) => s.id === id || entriesOf(s).some((e) => e.id === id || e.bullets.some((b) => b.id === id)),
  );
}

// Drops operations that point at things that don't exist or would lose content.
export function isApplicable(content: ResumeContent, op: z.infer<typeof operationSchema>) {
  switch (op.type) {
    case "update_bullet":
      return Boolean(findBullet(content, op.bulletId)) && op.text.trim().length > 0 && op.text.length <= 600;
    case "add_bullet": {
      const entry = entryOfBullet(content, op.afterBulletId);
      return Boolean(entry) && entry!.bullets.length < 20 && op.text.trim().length > 0 && op.text.length <= 600;
    }
    case "update_headline":
      return op.text.trim().length > 0 && op.text.length <= 200;
    case "set_hidden":
      return hasTarget(content, op.targetId);
    case "reorder": {
      const current = childIds(content, op.parentId);
      return (
        Boolean(current) &&
        current!.length === op.orderedIds.length &&
        current!.every((id) => op.orderedIds.includes(id))
      );
    }
    case "update_skills": {
      const group = findSkillGroup(content, op.groupId);
      return Boolean(group) && op.items.length > 0;
    }
    case "replace_source":
      return false;
  }
}

function reorderBy<T extends { id: string }>(items: T[], orderedIds: string[]) {
  return orderedIds.map((id) => items.find((item) => item.id === id)!);
}

export function applyOperations(content: ResumeContent, operations: Operation[]): ResumeContent {
  const next: ResumeContent = structuredClone(content);
  // Several bullets added after the same one keep the order the AI gave them.
  const lastAdded = new Map<string, string>();
  for (const op of operations) {
    switch (op.type) {
      case "add_bullet": {
        const after = lastAdded.get(op.afterBulletId) ?? op.afterBulletId;
        const entry = entryOfBullet(next, after);
        if (!entry || entry.bullets.length >= 20) break;
        entry.bullets.splice(entry.bullets.findIndex((b) => b.id === after) + 1, 0, {
          id: op.id,
          text: op.text,
          hidden: false,
        });
        lastAdded.set(op.afterBulletId, op.id);
        break;
      }
      case "update_bullet": {
        const bullet = findBullet(next, op.bulletId);
        if (bullet) bullet.text = op.text;
        break;
      }
      case "update_headline":
        next.basics.headline = op.text;
        break;
      case "set_hidden":
        for (const section of next.sections) {
          if (section.id === op.targetId) section.hidden = op.hidden;
          for (const entry of entriesOf(section)) {
            if (entry.id === op.targetId) entry.hidden = op.hidden;
            for (const bullet of entry.bullets) if (bullet.id === op.targetId) bullet.hidden = op.hidden;
          }
        }
        break;
      case "reorder":
        if (op.parentId === "sections") {
          next.sections = reorderBy(next.sections, op.orderedIds);
          break;
        }
        for (const section of next.sections) {
          if (section.id === op.parentId) {
            if (section.type === "skills") section.groups = reorderBy(section.groups, op.orderedIds);
            else if ("entries" in section)
              (section as { entries: Entry[] }).entries = reorderBy(entriesOf(section), op.orderedIds);
          }
          for (const entry of entriesOf(section)) {
            if (entry.id === op.parentId) entry.bullets = reorderBy(entry.bullets, op.orderedIds);
          }
        }
        break;
      case "update_skills": {
        const group = findSkillGroup(next, op.groupId);
        if (group) group.items = op.items;
        break;
      }
      case "replace_source":
        break;
    }
  }
  return next;
}

// Terms that look like facts: numbers, and technology or proper names.
const factPattern =
  /\b\d+(?:[.,]\d+)?(?:\s*(?:%|x|\+|[kKmMbB]\b|cr\b|lpa\b|ms\b))?|\b[a-z]+\d+[a-z0-9]*\b|\b[A-Z][A-Za-z0-9]*(?:[.#+-][A-Za-z0-9]+)*\+{0,2}|\b[a-z]+(?:\.[a-z]+)+\b/g;
const ignored = new Set([
  "i",
  "a",
  "the",
  "built",
  "led",
  "developed",
  "designed",
  "implemented",
  "created",
  "improved",
]);

function normalizeTerm(term: string) {
  return term.toLowerCase().replace(/\s+/g, "");
}

// Flags facts in new text that appear nowhere in what the user has told us.
export function unverifiedTerms(text: string, factSources: string[]) {
  const corpus = normalizeTerm(factSources.join(" \n "));
  const terms = new Set<string>();
  for (const match of text.replace(/\*\*/g, "").matchAll(factPattern)) {
    const term = match[0].trim();
    const normalized = normalizeTerm(term);
    if (normalized.length < 2 || ignored.has(normalized)) continue;
    // Sentence-initial capitals are usually ordinary words, not facts.
    if (/^[A-Z][a-z]+$/.test(term) && text.trim().startsWith(term)) continue;
    if (!corpus.includes(normalized)) terms.add(term);
  }
  return [...terms];
}

// Plain text of everything the user has written, used as the source of truth for fact checks.
export function factText(content: ResumeContent) {
  return JSON.stringify(content).replace(/"(id|hidden|type)":"?[^,"}]*"?,?/g, " ");
}
