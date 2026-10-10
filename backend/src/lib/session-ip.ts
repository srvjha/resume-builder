// Better Auth records the client IP on every session. Rate limiting reads it per request; it is never persisted.
export function withoutIp<T extends { ipAddress?: string | null | undefined }>(session: T): T {
  return { ...session, ipAddress: null };
}
