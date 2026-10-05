import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import { auth, type AuthUser } from "../lib/auth.js";
import { UnauthorizedError } from "../lib/errors.js";

// One session lookup per request, shared by optionalAuth (run for every /v1 request, so rate limits can
// count per account) and requireAuth.
const lookups = new WeakMap<Request, ReturnType<typeof auth.api.getSession>>();
export function sessionOf(req: Request) {
  let lookup = lookups.get(req);
  if (!lookup) {
    lookup = auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    lookups.set(req, lookup);
  }
  return lookup;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const result = await sessionOf(req);
  if (!result) throw new UnauthorizedError();
  req.user = result.user;
  req.session = result.session;
  next();
}

// For handlers behind requireAuth.
export function currentUser(req: { user?: AuthUser | undefined }): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
