import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  deletePrefix(prefix: string): Promise<void>;
  // Deletes objects under a prefix last modified before the cutoff. Returns how many were deleted.
  deleteOlder(prefix: string, cutoff: Date): Promise<number>;
  // The newest object under a prefix whose keys sort by time, e.g. timestamped backups.
  latest(prefix: string): Promise<{ key: string; sizeBytes: number; modifiedAt: Date } | null>;
}

// An empty prefix matches every key, and the database backups live in the same bucket.
export function assertDeletablePrefix(prefix: string): void {
  const trimmed = prefix.trim();
  if (trimmed === "" || /^\/+$/.test(trimmed)) {
    throw new Error("Refusing to delete with an empty storage prefix");
  }
}

export function staleKeys(objects: { key: string; modifiedAt: Date }[], cutoff: Date): string[] {
  return objects.filter((object) => object.modifiedAt < cutoff).map((object) => object.key);
}

function localStorage(root: string): Storage {
  const pathFor = (key: string) => {
    const path = resolve(root, key);
    if (!path.startsWith(resolve(root))) throw new Error(`Invalid storage key: ${key}`);
    return path;
  };
  return {
    async put(key, body) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    },
    async get(key) {
      try {
        return await readFile(pathFor(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async deletePrefix(prefix) {
      assertDeletablePrefix(prefix);
      await rm(pathFor(prefix), { recursive: true, force: true });
    },
    async deleteOlder(prefix, cutoff) {
      assertDeletablePrefix(prefix);
      const dir = pathFor(prefix);
      const names = await readdir(dir).catch(() => [] as string[]);
      const files = await Promise.all(
        names.map(async (name) => ({ key: name, modifiedAt: (await stat(resolve(dir, name))).mtime })),
      );
      const stale = staleKeys(files, cutoff);
      await Promise.all(stale.map((name) => rm(resolve(dir, name), { force: true })));
      return stale.length;
    },
    async latest(prefix) {
      const dir = pathFor(prefix);
      const names = await readdir(dir).catch(() => [] as string[]);
      const name = names.sort().at(-1);
      if (!name) return null;
      const info = await stat(resolve(dir, name));
      return { key: `${prefix}${name}`, sizeBytes: info.size, modifiedAt: info.mtime };
    },
  };
}

function r2Storage(): Storage {
  const bucket = env.R2_BUCKET!;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  // DeleteObjects reports per-key failures in its response instead of throwing, so each one is logged here.
  // Returns how many keys failed.
  async function deleteKeys(keys: string[]) {
    if (keys.length === 0) return 0;
    const { Errors = [] } = await client.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
    );
    for (const error of Errors) {
      logger.error({ key: error.Key, code: error.Code, message: error.Message }, "Could not delete storage object");
    }
    return Errors.length;
  }
  async function listPages(prefix: string, visit: (objects: { key: string; modifiedAt: Date }[]) => Promise<void>) {
    let token: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
      );
      await visit(
        (page.Contents ?? []).map((object) => ({ key: object.Key!, modifiedAt: object.LastModified ?? new Date(0) })),
      );
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      try {
        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return Buffer.from(await object.Body!.transformToByteArray());
      } catch (err) {
        if (err instanceof NoSuchKey) return null;
        throw err;
      }
    },
    async deletePrefix(prefix) {
      assertDeletablePrefix(prefix);
      let failed = 0;
      await listPages(prefix, async (objects) => {
        failed += await deleteKeys(objects.map((object) => object.key));
      });
      if (failed > 0) throw new Error(`${failed} storage objects under ${prefix} could not be deleted`);
    },
    async deleteOlder(prefix, cutoff) {
      assertDeletablePrefix(prefix);
      let deleted = 0;
      let failed = 0;
      await listPages(prefix, async (objects) => {
        const stale = staleKeys(objects, cutoff);
        const failedNow = await deleteKeys(stale);
        deleted += stale.length - failedNow;
        failed += failedNow;
      });
      if (failed > 0) throw new Error(`${failed} stale storage objects under ${prefix} could not be deleted`);
      return deleted;
    },
    async latest(prefix) {
      let newest: { key: string; sizeBytes: number; modifiedAt: Date } | null = null;
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
        );
        const last = page.Contents?.at(-1);
        if (last?.Key)
          newest = { key: last.Key, sizeBytes: last.Size ?? 0, modifiedAt: last.LastModified ?? new Date(0) };
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return newest;
    },
  };
}

export const storage: Storage = env.STORAGE_DRIVER === "r2" ? r2Storage() : localStorage(env.LOCAL_STORAGE_DIR);
