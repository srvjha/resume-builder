import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { customTemplates, jobs, resumes, resumeVersions } from "../../db/schema/index.js";
import { AppError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { emptyResumeContent, type ResumeContent, resumeContentSchema } from "../../schemas/resume-content.js";
import { findTemplate } from "../../templates/index.js";
import { createImport } from "../imports/imports.service.js";
import { renderStructured } from "../pdfs/pdfs.service.js";
import { getProfile } from "../profiles/profiles.service.js";
import { assertTemplateExists } from "../templates/templates.service.js";
import { assertResumeQuota } from "../usage/quotas.js";
import type { z } from "zod";
import type { createResumeBody, createVersionBody, updateResumeBody } from "./resumes.schemas.js";
import { track } from "../../lib/analytics.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type VersionKind = (typeof resumeVersions.$inferInsert)["kind"];
type VersionPayload = { content: ResumeContent; texSource?: never } | { texSource: string; content?: never };

const DEFAULT_TEMPLATE = "developer";

const versionSummaryColumns = {
  id: resumeVersions.id,
  parentId: resumeVersions.parentId,
  kind: resumeVersions.kind,
  label: resumeVersions.label,
  semver: resumeVersions.semver,
  createdAt: resumeVersions.createdAt,
};

function toVersionDetail(version: typeof resumeVersions.$inferSelect) {
  return {
    id: version.id,
    parentId: version.parentId,
    kind: version.kind,
    label: version.label,
    semver: version.semver,
    createdAt: version.createdAt,
    content: version.content ? resumeContentSchema.parse(version.content) : null,
    texSource: version.texSource,
  };
}

export async function getOwnedResume(userId: string, resumeId: string, executor: Tx | typeof db = db) {
  const [resume] = await executor
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId), isNull(resumes.deletedAt)))
    .limit(1);
  if (!resume) throw new NotFoundError("Resume");
  return resume;
}

async function getVersionRow(resumeId: string, versionId: string, executor: Tx | typeof db = db) {
  const [version] = await executor
    .select()
    .from(resumeVersions)
    .where(and(eq(resumeVersions.id, versionId), eq(resumeVersions.resumeId, resumeId)))
    .limit(1);
  if (!version) throw new NotFoundError("Version");
  return version;
}

async function assertJobOwned(userId: string, jobId: string) {
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  if (!job) throw new NotFoundError("Job");
}

// Appends a version and moves the resume's head to it. Version content is never changed afterwards.
export async function appendVersion(
  tx: Tx,
  resume: typeof resumes.$inferSelect,
  kind: VersionKind,
  payload: VersionPayload,
  meta: { label?: string | undefined; semver?: string | undefined } = {},
) {
  if (resume.mode === "structured" && !payload.content) {
    throw new ValidationError([{ location: "body", path: "content", message: "Structured resumes need content" }]);
  }
  if (resume.mode === "code" && !payload.texSource) {
    throw new ValidationError([{ location: "body", path: "texSource", message: "Code-mode resumes need texSource" }]);
  }

  const [version] = await tx
    .insert(resumeVersions)
    .values({
      resumeId: resume.id,
      parentId: resume.headVersionId,
      kind,
      content: payload.content ?? null,
      texSource: payload.texSource ?? null,
      label: meta.label ?? null,
      semver: meta.semver ?? null,
    })
    .returning();

  await tx.update(resumes).set({ headVersionId: version!.id, updatedAt: new Date() }).where(eq(resumes.id, resume.id));
  return version!;
}

async function resolveSource(
  userId: string,
  input: z.infer<typeof createResumeBody>,
  templateId: string | null,
): Promise<{ payload: VersionPayload; kind: VersionKind; sourceResumeId: string | null }> {
  const source = input.source;
  const asMode = (content: ResumeContent): VersionPayload => {
    if (input.mode === "structured") return { content };
    const template = findTemplate(templateId ?? DEFAULT_TEMPLATE);
    if (!template) throw new NotFoundError("Template");
    return { texSource: template.render(content) };
  };

  switch (source.type) {
    case "blank":
      return {
        payload: input.mode === "structured" ? { content: emptyResumeContent } : asMode(emptyResumeContent),
        kind: "manual",
        sourceResumeId: null,
      };
    case "profile":
      return { payload: asMode((await getProfile(userId)).content), kind: "import", sourceResumeId: null };
    case "content":
      return { payload: asMode(source.content), kind: "import", sourceResumeId: null };
    case "tex":
      if (input.mode !== "code") {
        throw new ValidationError([
          {
            location: "body",
            path: "mode",
            message: "Pasted LaTeX creates a code-mode resume; convert it with an import",
          },
        ]);
      }
      return { payload: { texSource: source.texSource }, kind: "import", sourceResumeId: null };
    case "resume": {
      const original = await getOwnedResume(userId, source.resumeId);
      const versionId = source.versionId ?? original.headVersionId;
      if (!versionId) throw new NotFoundError("Version");
      const version = toVersionDetail(await getVersionRow(original.id, versionId));
      if (version.content) return { payload: asMode(version.content), kind: "manual", sourceResumeId: original.id };
      if (input.mode === "structured") {
        throw new ValidationError([
          {
            location: "body",
            path: "mode",
            message: "A code-mode resume can only be copied as code; convert it with an import",
          },
        ]);
      }
      return { payload: { texSource: version.texSource! }, kind: "manual", sourceResumeId: original.id };
    }
    case "customTemplate": {
      const [template] = await db
        .select()
        .from(customTemplates)
        .where(and(eq(customTemplates.id, source.customTemplateId), eq(customTemplates.userId, userId)))
        .limit(1);
      if (!template) throw new NotFoundError("Template");
      if (template.mode === "code") {
        if (input.mode !== "code") throw modeMismatch("A LaTeX template creates a code-mode resume");
        return { payload: { texSource: template.texSource! }, kind: "manual", sourceResumeId: null };
      }
      return { payload: asMode(resumeContentSchema.parse(template.content)), kind: "manual", sourceResumeId: null };
    }
  }
}

function modeMismatch(message: string) {
  return new ValidationError([{ location: "body", path: "mode", message }]);
}

export async function createResume(userId: string, input: z.infer<typeof createResumeBody>) {
  await assertResumeQuota(userId);
  const templateId = input.templateId ?? (input.mode === "structured" ? DEFAULT_TEMPLATE : null);
  if (templateId) await assertTemplateExists(templateId);
  if (input.jobId) await assertJobOwned(userId, input.jobId);

  const { payload, kind, sourceResumeId } = await resolveSource(userId, input, templateId);

  const created = await db.transaction(async (tx) => {
    const [resume] = await tx
      .insert(resumes)
      .values({
        userId,
        title: input.title,
        mode: input.mode,
        templateId: input.mode === "structured" ? templateId : null,
        jobId: input.jobId ?? null,
        sourceResumeId,
        pageLimit: input.pageLimit,
        ...(input.mode === "structured" && input.layout && { layout: input.layout }),
      })
      .returning();
    const head = await appendVersion(tx, resume!, kind, payload);
    return { ...resume!, headVersionId: head.id, head: toVersionDetail(head) };
  });
  track(userId, "resume_created", { mode: input.mode, source: input.source.type, template: templateId });
  return created;
}

export async function listResumes(userId: string, archived: boolean) {
  return db
    .select()
    .from(resumes)
    .where(
      and(
        eq(resumes.userId, userId),
        isNull(resumes.deletedAt),
        archived ? isNotNull(resumes.archivedAt) : isNull(resumes.archivedAt),
      ),
    )
    .orderBy(desc(resumes.updatedAt));
}

export async function getResume(userId: string, resumeId: string) {
  const resume = await getOwnedResume(userId, resumeId);
  const head = resume.headVersionId ? toVersionDetail(await getVersionRow(resume.id, resume.headVersionId)) : null;
  return { ...resume, head };
}

export async function updateResume(userId: string, resumeId: string, changes: z.infer<typeof updateResumeBody>) {
  const resume = await getOwnedResume(userId, resumeId);
  const update: Partial<typeof resumes.$inferInsert> = { updatedAt: new Date() };

  if (changes.title) update.title = changes.title;
  if (changes.pageLimit) update.pageLimit = changes.pageLimit;
  if (changes.templateId) {
    if (resume.mode === "code")
      throw new AppError(400, "TEMPLATE_NOT_ALLOWED", "Code-mode resumes don't use templates");
    await assertTemplateExists(changes.templateId);
    update.templateId = changes.templateId;
  }
  if (changes.layout) {
    if (resume.mode === "code") throw new AppError(400, "LAYOUT_NOT_ALLOWED", "Code-mode resumes set their own layout");
    update.layout = changes.layout;
  }
  if (changes.jobId !== undefined) {
    if (changes.jobId) await assertJobOwned(userId, changes.jobId);
    update.jobId = changes.jobId;
  }
  if (changes.archived !== undefined) update.archivedAt = changes.archived ? new Date() : null;

  const [updated] = await db.update(resumes).set(update).where(eq(resumes.id, resume.id)).returning();
  return changes.mode && changes.mode !== resume.mode ? switchMode(userId, updated!, changes.mode) : updated!;
}

// The resume keeps its template while in LaTeX, so switching back uses the same one.
async function switchMode(userId: string, resume: typeof resumes.$inferSelect, mode: "structured" | "code") {
  const head = toVersionDetail(await getVersionRow(resume.id, resume.headVersionId!));
  const payload: VersionPayload =
    mode === "code"
      ? { texSource: renderStructured(resume.templateId, head.content!, resume.layout) }
      : { content: (await createImport(userId, { texSource: head.texSource! })).content };
  const templateId = resume.templateId ?? DEFAULT_TEMPLATE;
  return db.transaction(async (tx) => {
    const [switched] = await tx
      .update(resumes)
      .set({ mode, templateId, updatedAt: new Date() })
      .where(eq(resumes.id, resume.id))
      .returning();
    const version = await appendVersion(tx, switched!, mode === "code" ? "manual" : "import", payload, {
      label: mode === "code" ? "Switched to LaTeX" : "Switched to form",
    });
    track(userId, "resume_mode_switched", { mode });
    return { ...switched!, headVersionId: version.id };
  });
}

export async function deleteResume(userId: string, resumeId: string) {
  const resume = await getOwnedResume(userId, resumeId);
  await db.update(resumes).set({ deletedAt: new Date() }).where(eq(resumes.id, resume.id));
}

export async function listVersions(userId: string, resumeId: string, limit: number, before?: Date) {
  const resume = await getOwnedResume(userId, resumeId);
  return db
    .select(versionSummaryColumns)
    .from(resumeVersions)
    .where(and(eq(resumeVersions.resumeId, resume.id), before ? lt(resumeVersions.createdAt, before) : undefined))
    .orderBy(desc(resumeVersions.createdAt))
    .limit(limit);
}

export async function getVersion(userId: string, resumeId: string, versionId: string) {
  const resume = await getOwnedResume(userId, resumeId);
  return toVersionDetail(await getVersionRow(resume.id, versionId));
}

export async function createVersion(userId: string, resumeId: string, input: z.infer<typeof createVersionBody>) {
  return db.transaction(async (tx) => {
    const resume = await getOwnedResume(userId, resumeId, tx);

    if (input.kind === "ai") {
      throw new Error("AI versions are created by suggestions.applySuggestion");
    }

    if (input.kind === "restore") {
      const from = await getVersionRow(resume.id, input.fromVersionId, tx);
      const payload: VersionPayload = from.content
        ? { content: resumeContentSchema.parse(from.content) }
        : { texSource: from.texSource! };
      // Restoring a version from before a form/LaTeX switch switches the resume back too.
      const mode = from.content ? "structured" : "code";
      if (mode !== resume.mode) await tx.update(resumes).set({ mode }).where(eq(resumes.id, resume.id));
      return toVersionDetail(
        await appendVersion(tx, { ...resume, mode }, "restore", payload, {
          label: `Restored from ${from.createdAt.toISOString()}`,
        }),
      );
    }

    if (input.baseVersionId) {
      // Row-locks the resume, so a concurrent save on the same base waits here and then finds the head moved.
      const [current] = await tx
        .update(resumes)
        .set({ updatedAt: new Date() })
        .where(and(eq(resumes.id, resume.id), eq(resumes.headVersionId, input.baseVersionId)))
        .returning({ id: resumes.id });
      if (!current) throw new AppError(409, "VERSION_CONFLICT", "This resume was changed somewhere else");
    }
    const payload = (input.content ? { content: input.content } : { texSource: input.texSource }) as VersionPayload;
    const kind: VersionKind = input.label ? "named" : "manual";
    return toVersionDetail(
      await appendVersion(tx, resume, kind, payload, { label: input.label, semver: input.semver }),
    );
  });
}

export async function updateVersion(
  userId: string,
  resumeId: string,
  versionId: string,
  changes: { label?: string | null | undefined; semver?: string | null | undefined },
) {
  const resume = await getOwnedResume(userId, resumeId);
  await getVersionRow(resume.id, versionId);
  const [updated] = await db
    .update(resumeVersions)
    .set({
      ...(changes.label !== undefined && { label: changes.label }),
      ...(changes.semver !== undefined && { semver: changes.semver }),
    })
    .where(eq(resumeVersions.id, versionId))
    .returning();
  return toVersionDetail(updated!);
}
