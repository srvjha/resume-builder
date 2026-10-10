import { recordStep, timed } from "../../middleware/request-metrics.js";
import { logger } from "../logger.js";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { env } from "../../config/env.js";
import { AppError } from "../errors.js";
import { storage } from "../storage.js";
import { type CompileError, createTectonic, makeXetexCompatible } from "./tectonic.js";

export type { CompileError };
export type CompileResult =
  { ok: true; pdf: Buffer; pageCount: number; cached: boolean } | { ok: false; errors: CompileError[] };

// Development only: compiles in-process. Production uses the separate compiler service (COMPILER_URL).
const localCompile = env.COMPILER_URL
  ? null
  : createTectonic({
      bin: env.TECTONIC_BIN,
      onlyCached: env.TECTONIC_ONLY_CACHED,
      timeoutMs: env.COMPILE_TIMEOUT_MS,
      concurrency: env.COMPILE_CONCURRENCY,
    });

async function remoteCompile(tex: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(env.COMPILE_TIMEOUT_MS + 5_000);
  const response = await fetch(`${env.COMPILER_URL}/compile`, {
    method: "POST",
    headers: { "content-type": "text/plain; charset=utf-8" },
    body: tex,
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  });
  if (response.status === 200) return { ok: true as const, pdf: Buffer.from(await response.arrayBuffer()) };
  if (response.status === 422) {
    const body = (await response.json()) as { errors: CompileError[] };
    return { ok: false as const, errors: body.errors };
  }
  if (response.status === 413) throw new AppError(413, "PAYLOAD_TOO_LARGE", "The LaTeX source is too large");
  throw new AppError(502, "COMPILER_UNAVAILABLE", "The LaTeX compiler is unavailable. Try again.");
}

async function pageCount(pdf: Buffer) {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  return doc.getPageCount();
}

// ponytail: failures are remembered in this process's memory only, so a restart or a second API process compiles
// a bad source once more. Capped at 500 entries; oldest dropped first.
const failures = new Map<string, { result: Extract<CompileResult, { ok: false }>; until: number }>();
const failureTtlMs = 5 * 60_000;

export async function compileTex(source: string, signal?: AbortSignal): Promise<CompileResult> {
  const tex = makeXetexCompatible(source);
  const hash = createHash("sha256").update(tex).digest("hex");
  const cacheKey = `compiled/${hash}.pdf`;

  const failed = failures.get(hash);
  if (failed && failed.until > Date.now()) return failed.result;

  const cachedPdf = await timed("cache_lookup_ms", () => storage.get(cacheKey));
  recordStep("compile_cached", Boolean(cachedPdf));
  if (cachedPdf) return { ok: true, pdf: cachedPdf, pageCount: await pageCount(cachedPdf), cached: true };

  const result = await timed("compile_ms", () =>
    localCompile ? localCompile(tex, signal) : remoteCompile(tex, signal),
  );
  if (!result.ok) {
    if (failures.size >= 500) failures.delete(failures.keys().next().value!);
    failures.set(hash, { result, until: Date.now() + failureTtlMs });
    return result;
  }

  // Caching is for next time, so the response doesn't wait for the upload.
  storage.put(cacheKey, result.pdf, "application/pdf").catch((err: unknown) => {
    logger.warn({ err }, "Could not cache a compiled PDF");
  });
  return { ok: true, pdf: result.pdf, pageCount: await pageCount(result.pdf), cached: false };
}
