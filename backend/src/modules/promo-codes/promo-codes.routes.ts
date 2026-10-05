import { Router } from "express";
import { sendData } from "../../lib/http.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { currentUser, requireAuth } from "../../middleware/require-auth.js";
import { redeemLimiter } from "../../middleware/rate-limit.js";
import { validated } from "../../middleware/validate.js";
import { subscriptionResponse } from "../billing/billing.schemas.js";
import {
  createPromoCodeBody,
  createRedemptionBody,
  promoCodeListResponse,
  promoCodeParams,
  updatePromoCodeBody,
} from "./promo-codes.schemas.js";
import * as service from "./promo-codes.service.js";

export const promoCodesRouter = Router();

promoCodesRouter.post(
  "/promo-redemptions",
  requireAuth,
  redeemLimiter,
  ...validated({ body: createRedemptionBody }, async (req, res) => {
    sendData(res, subscriptionResponse, await service.redeemCode(currentUser(req).id, req.body.code), 201);
  }),
);

promoCodesRouter.use("/admin/promo-codes", requireAuth, requireAdmin);

promoCodesRouter.get("/admin/promo-codes", async (_req, res) => {
  sendData(res, promoCodeListResponse, await service.listPromoCodes());
});

promoCodesRouter.post(
  "/admin/promo-codes",
  ...validated({ body: createPromoCodeBody }, async (req, res) => {
    await service.createPromoCode(currentUser(req).id, req.body);
    sendData(res, promoCodeListResponse, await service.listPromoCodes(), 201);
  }),
);

promoCodesRouter.patch(
  "/admin/promo-codes/:promoCodeId",
  ...validated({ params: promoCodeParams, body: updatePromoCodeBody }, async (req, res) => {
    await service.setPromoCodeActive(req.params.promoCodeId, req.body.active);
    sendData(res, promoCodeListResponse, await service.listPromoCodes());
  }),
);
