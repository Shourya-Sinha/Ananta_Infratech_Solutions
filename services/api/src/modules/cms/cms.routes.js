"use strict";

const express = require("express");
const { z } = require("zod");
const { CmsService } = require("./cms.service");
const { authenticate } = require("../../middleware/authenticate");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../middleware/errorHandler");
const { inquiryRateLimit } = require("../../middleware/rateLimit");
const { WEBSITE_INQUIRY_KINDS, WEBSITE_INQUIRY_STATUSES } = require("../../db/models/WebsiteInquiry");

// ── Public (no auth) ────────────────────────────────────────────────────────
const publicRouter = express.Router();

const PHONE = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{8,20}$/, "Enter a valid phone number");
const OPTIONAL_TEXT = (max) => z.string().trim().max(max).optional().or(z.literal(""));
const EMAIL = z.string().trim().email("Please enter a valid email address").max(160).optional().or(z.literal(""));

const inquirySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CONTACT"),
    name: z.string().trim().min(2, "Please enter your full name").max(120),
    phone: PHONE,
    email: EMAIL,
    service: OPTIONAL_TEXT(120),
    message: z.string().trim().min(5, "Please tell us a little about your project").max(2000)
  }),
  z.object({
    kind: z.literal("CAREER_CONTRACTOR"),
    name: z.string().trim().min(2, "Please enter your full name").max(120),
    phone: PHONE,
    email: EMAIL,
    city: z.string().trim().min(2, "Please enter your full name").max(120),
    company: OPTIONAL_TEXT(160),
    trade: OPTIONAL_TEXT(120),
    message: OPTIONAL_TEXT(2000)
  }),
  z.object({
    kind: z.literal("CAREER_WORKER"),
    name: z.string().trim().min(2, "Please enter your full name").max(120),
    phone: PHONE,
    email: EMAIL,
    city: z.string().trim().min(2, "Please enter your full name").max(120),
    trade: z.string().trim().min(2, "Please enter your full name").max(120),
    experienceYears: z.coerce.number().min(0).max(60).optional(),
    message: OPTIONAL_TEXT(2000)
  })
]);

publicRouter.get(
  "/site",
  asyncHandler(async (_req, res) => {
    const data = await CmsService.getPublicSite();
    res.set("Cache-Control", "public, max-age=30");
    res.json({ success: true, data });
  })
);

publicRouter.post(
  "/inquiries",
  inquiryRateLimit,
  asyncHandler(async (req, res) => {
    const input = inquirySchema.parse(req.body);
    // Drop empty optional strings so the DB stores only what was filled in.
    const clean = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== "" && v !== undefined)
    );
    const data = await CmsService.createInquiry(clean);
    res.status(201).json({ success: true, data });
  })
);

// ── Admin (CMS editor) ──────────────────────────────────────────────────────
const cmsRouter = express.Router();
cmsRouter.use(authenticate);

function auditMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") };
}

cmsRouter.get(
  "/",
  requirePermission("cms.manage"),
  asyncHandler(async (_req, res) => {
    const data = await CmsService.getEditorState();
    res.json({ success: true, data });
  })
);

cmsRouter.put(
  "/draft",
  requirePermission("cms.manage"),
  asyncHandler(async (req, res) => {
    const data = await CmsService.saveDraft(req.body?.content ?? req.body, req.auth.userId, auditMeta(req));
    res.json({ success: true, data });
  })
);

cmsRouter.post(
  "/publish",
  requirePermission("cms.manage"),
  asyncHandler(async (req, res) => {
    const data = await CmsService.publish(req.auth.userId, auditMeta(req));
    res.json({ success: true, data });
  })
);

cmsRouter.post(
  "/discard",
  requirePermission("cms.manage"),
  asyncHandler(async (req, res) => {
    const data = await CmsService.discardDraft(req.auth.userId, auditMeta(req));
    res.json({ success: true, data });
  })
);

cmsRouter.get(
  "/inquiries",
  requirePermission("cms.manage"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        kind: z.enum(WEBSITE_INQUIRY_KINDS).optional(),
        status: z.enum(WEBSITE_INQUIRY_STATUSES).optional()
      })
      .parse(req.query);
    const data = await CmsService.listInquiries(query);
    res.json({ success: true, data });
  })
);

cmsRouter.patch(
  "/inquiries/:id",
  requirePermission("cms.manage"),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(WEBSITE_INQUIRY_STATUSES) }).parse(req.body);
    const data = await CmsService.updateInquiryStatus(req.params.id, status, req.auth.userId, auditMeta(req));
    res.json({ success: true, data });
  })
);

exports.cmsRouter = cmsRouter;
exports.publicRouter = publicRouter;
