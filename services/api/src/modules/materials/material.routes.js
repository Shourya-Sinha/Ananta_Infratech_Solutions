"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.materialRouter = void 0;
const express = require("express");
const { z } = require("zod");
const { MaterialService } = require("./material.service");
const { authenticate } = require("../../middleware/authenticate");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../middleware/errorHandler");

const materialRouter = exports.materialRouter = express.Router();
materialRouter.use(authenticate);

const UNITS = ["KG", "BAG", "PIECE", "LITER", "CUBIC_METER", "SQ_FEET", "METER", "TON", "BOX", "ROLL", "OTHER"];

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().max(40).optional(),
  unit: z.enum(UNITS).default("KG"),
  category: z.string().trim().max(100).optional(),
  initialStock: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  lastPurchaseRateRupees: z.number().positive().optional(),
  supplier: z.string().optional()
});
const updateSchema = createSchema.partial().extend({
  addStock: z.number().optional()
});

const issueSchema = z.object({
  materialId: z.string().min(1),
  siteId: z.string().min(1),
  quantity: z.number().positive(),
  ratePaise: z.number().nonnegative().optional(),
  date: z.string().date(),
  type: z.enum(["ISSUE", "RETURN"]).default("ISSUE"),
  issuedTo: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional()
});

materialRouter.post("/", requirePermission("material.create"), asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  const m = await MaterialService.create(input, req.auth.userId);
  res.status(201).json({ success: true, data: m });
}));

materialRouter.get("/", requirePermission("material.read"), asyncHandler(async (req, res) => {
  const query = z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    lowStock: z.string().optional()
  }).parse(req.query);
  const list = await MaterialService.list(query);
  res.json({ success: true, data: list });
}));

materialRouter.get("/:id", requirePermission("material.read"), asyncHandler(async (req, res) => {
  const m = await MaterialService.get(req.params.id);
  res.json({ success: true, data: m });
}));

materialRouter.patch("/:id", requirePermission("material.update"), asyncHandler(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const m = await MaterialService.update(req.params.id, input, req.auth.userId);
  res.json({ success: true, data: m });
}));

materialRouter.delete("/:id", requirePermission("material.delete"), asyncHandler(async (req, res) => {
  const r = await MaterialService.remove(req.params.id, req.auth.userId);
  res.json({ success: true, data: r });
}));

materialRouter.post("/issue", requirePermission("material.issue"), asyncHandler(async (req, res) => {
  const input = issueSchema.parse(req.body);
  const issue = await MaterialService.issue(input, req.auth.userId);
  res.status(201).json({ success: true, data: issue });
}));

materialRouter.get("/issues/list", requirePermission("material.issue"), asyncHandler(async (req, res) => {
  const query = z.object({
    site: z.string().optional(),
    material: z.string().optional(),
    type: z.enum(["ISSUE", "RETURN"]).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional()
  }).parse(req.query);
  const issues = await MaterialService.listIssues(query);
  res.json({ success: true, data: issues });
}));
