import { Router } from "express";
import multer from "multer";
import { AppError } from "../../lib/errors.js";
import { sendData } from "../../lib/http.js";
import { uploadLimiter } from "../../middleware/rate-limit.js";
import { currentUser, requireAuth } from "../../middleware/require-auth.js";
import { validated } from "../../middleware/validate.js";
import { uploadParams, uploadResponse } from "./uploads.schemas.js";
import { createUpload, deleteUpload, getOwnedUpload, MAX_UPLOAD_BYTES } from "./uploads.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

export const uploadsRouter = Router();

uploadsRouter.post("/uploads", requireAuth, uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) throw new AppError(400, "FILE_REQUIRED", 'Send the file in a multipart field named "file"');
  sendData(res, uploadResponse, await createUpload(currentUser(req).id, req.file), 201);
});

uploadsRouter.get(
  "/uploads/:uploadId",
  requireAuth,
  ...validated({ params: uploadParams }, async (req, res) => {
    sendData(res, uploadResponse, await getOwnedUpload(currentUser(req).id, req.params.uploadId));
  }),
);

uploadsRouter.delete(
  "/uploads/:uploadId",
  requireAuth,
  ...validated({ params: uploadParams }, async (req, res) => {
    await deleteUpload(currentUser(req).id, req.params.uploadId);
    res.status(204).end();
  }),
);
