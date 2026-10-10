import type { Request } from "express";
import { Router } from "express";
import { sendData } from "../../lib/http.js";
import { optionalAuth } from "../../middleware/optional-auth.js";
import { publicLimiter, sharePasswordLimiter } from "../../middleware/rate-limit.js";
import { validated } from "../../middleware/validate.js";
import { compileOrThrow, pdfFileName, sendPdf, texForVersion } from "../pdfs/pdfs.service.js";
import { publicProfileResponse, publicResumeParams, publicResumeResponse, publicUserParams } from "./public.schemas.js";
import * as service from "./public.service.js";

export const publicRouter = Router();

publicRouter.use("/public", publicLimiter);

function decoded(value: string | undefined) {
  try {
    return value && decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

// The frontend renders share pages server-side, so it forwards the visitor's own details in these headers.
function viewerFrom(req: Request) {
  return {
    userId: req.user?.id,
    visitorKey: req.get("x-share-visitor") ?? req.ip ?? "unknown",
    userAgent: req.get("x-share-user-agent") ?? req.get("user-agent") ?? "",
    referrer: req.get("x-share-referrer"),
    country: req.get("cf-ipcountry"),
    region: req.get("x-share-region"),
    city: decoded(req.get("x-share-city")),
  };
}

publicRouter.get(
  "/public/users/:username",
  ...validated({ params: publicUserParams }, async (req, res) => {
    sendData(res, publicProfileResponse, await service.getPublicProfile(req.params.username));
  }),
);

publicRouter.get(
  "/public/users/:username/resumes/:slug",
  sharePasswordLimiter,
  optionalAuth,
  ...validated({ params: publicResumeParams }, async (req, res) => {
    const { username, slug } = req.params;
    const { data, isListed } = await service.getPublicResume(
      username,
      slug,
      req.get("x-share-password"),
      req.get("x-share-contact-password"),
      viewerFrom(req),
    );
    if (!isListed) res.set("X-Robots-Tag", "noindex, nofollow");
    sendData(res, publicResumeResponse, data);
  }),
);

publicRouter.get(
  "/public/users/:username/resumes/:slug/pdf",
  sharePasswordLimiter,
  ...validated({ params: publicResumeParams }, async (req, res) => {
    const { username, slug } = req.params;
    const { resume, version, isListed } = await service.getPublicResumeForPdf(
      username,
      slug,
      req.get("x-share-password"),
      req.get("x-share-contact-password"),
    );
    const { pdf, pageCount } = await compileOrThrow(texForVersion(resume, version));
    if (!isListed) res.set("X-Robots-Tag", "noindex, nofollow");
    sendPdf(res, pdf, pdfFileName(version.content?.basics.name, resume.title), pageCount);
  }),
);
