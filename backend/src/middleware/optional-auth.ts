import type { NextFunction, Request, Response } from "express";
import { sessionOf } from "./require-auth.js";

// Attaches the user when signed in, but never rejects the request.
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const result = await sessionOf(req).catch(() => null);
  if (result) {
    req.user = result.user;
    req.session = result.session;
  }
  next();
}
