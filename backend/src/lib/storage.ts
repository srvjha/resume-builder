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

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  deletePrefix(prefix: string): Promise<void>;
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
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
        );
        const keys = (page.Contents ?? []).map((object) => ({ Key: object.Key! }));
        if (keys.length > 0) {
          await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
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
