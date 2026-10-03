import { Router } from "express";
import { sendData } from "../../lib/http.js";
import { currentUser, requireAuth } from "../../middleware/require-auth.js";
import { aiLimiter } from "../../middleware/rate-limit.js";
import { validated } from "../../middleware/validate.js";
import { aiKeyResponse, putAiKeyBody, updateAiKeyBody } from "./ai-keys.schemas.js";
import * as service from "./ai-keys.service.js";

export const aiKeysRouter = Router();

aiKeysRouter.use("/me/ai-key", requireAuth);

aiKeysRouter.get("/me/ai-key", async (req, res) => {
  sendData(res, aiKeyResponse, await service.getAiKey(currentUser(req).id));
});

// Tests the key with the provider before saving it.
aiKeysRouter.put(
  "/me/ai-key",
  aiLimiter,
  ...validated({ body: putAiKeyBody }, async (req, res) => {
    sendData(res, aiKeyResponse, await service.putAiKey(currentUser(req).id, req.body));
  }),
);

aiKeysRouter.patch(
  "/me/ai-key",
  aiLimiter,
  ...validated({ body: updateAiKeyBody }, async (req, res) => {
    sendData(res, aiKeyResponse, await service.updateAiKey(currentUser(req).id, req.body));
  }),
);

aiKeysRouter.delete("/me/ai-key", async (req, res) => {
  await service.deleteAiKey(currentUser(req).id);
  res.status(204).end();
});
