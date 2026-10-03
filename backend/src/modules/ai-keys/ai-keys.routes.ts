import { Router } from "express";
import { sendData } from "../../lib/http.js";
import { currentUser, requireAuth } from "../../middleware/require-auth.js";
import { aiLimiter } from "../../middleware/rate-limit.js";
import { validated } from "../../middleware/validate.js";
import {
  aiKeyListResponse,
  aiKeyParams,
  aiKeyResponse,
  aiModelListResponse,
  putAiKeyBody,
  updateAiKeyBody,
} from "./ai-keys.schemas.js";
import * as service from "./ai-keys.service.js";

export const aiKeysRouter = Router();

aiKeysRouter.use("/me/ai-keys", requireAuth);

aiKeysRouter.get("/me/ai-keys", async (req, res) => {
  sendData(res, aiKeyListResponse, await service.listAiKeys(currentUser(req).id));
});

aiKeysRouter.get(
  "/me/ai-keys/:provider/models",
  ...validated({ params: aiKeyParams }, async (req, res) => {
    sendData(res, aiModelListResponse, await service.listAiKeyModels(currentUser(req).id, req.params.provider));
  }),
);

// Tests the key with the provider before saving it, then makes it the enabled key.
aiKeysRouter.put(
  "/me/ai-keys/:provider",
  aiLimiter,
  ...validated({ params: aiKeyParams, body: putAiKeyBody }, async (req, res) => {
    sendData(res, aiKeyResponse, await service.putAiKey(currentUser(req).id, req.params.provider, req.body));
  }),
);

aiKeysRouter.patch(
  "/me/ai-keys/:provider",
  aiLimiter,
  ...validated({ params: aiKeyParams, body: updateAiKeyBody }, async (req, res) => {
    sendData(res, aiKeyResponse, await service.updateAiKey(currentUser(req).id, req.params.provider, req.body));
  }),
);

aiKeysRouter.delete(
  "/me/ai-keys/:provider",
  ...validated({ params: aiKeyParams }, async (req, res) => {
    await service.deleteAiKey(currentUser(req).id, req.params.provider);
    res.status(204).end();
  }),
);
