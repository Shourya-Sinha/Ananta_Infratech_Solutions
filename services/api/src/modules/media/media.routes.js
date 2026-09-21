"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRouter = void 0;

const { Router } = require("express");
const { z } = require("zod");
const { MediaService } = require("./media.service");
const { authenticate } = require("../../middleware/authenticate");
const { asyncHandler } = require("../../middleware/errorHandler");

const mediaRouter = (exports.mediaRouter = Router());
mediaRouter.use(authenticate);

const searchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(25).optional()
});

/**
 * GET /api/v1/media/youtube/search?q=...&limit=12
 * Returns embeddable YouTube results for the mini player. Any authenticated
 * admin may search; no extra permission is required for a read-only lookup.
 */
mediaRouter.get(
  "/youtube/search",
  asyncHandler(async (req, res) => {
    const input = searchSchema.parse(req.query);
    const result = await MediaService.searchYouTube(input.q, input.limit ?? 12);
    res.json({ success: true, data: result });
  })
);
