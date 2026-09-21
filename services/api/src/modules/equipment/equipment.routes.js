"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.equipmentRouter = void 0;
const express = require("express");
const { z } = require("zod");
const { EquipmentService } = require("./equipment.service");
const { authenticate } = require("../../middleware/authenticate");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../middleware/errorHandler");

const equipmentRouter = exports.equipmentRouter = express.Router();
equipmentRouter.use(authenticate);

const CATEGORIES = ["EXCAVATOR", "MIXER", "TOOL", "VEHICLE", "ELECTRICAL", "SAFETY", "SCAFFOLDING", "MEASUREMENT", "OTHER"];
const CONDITIONS = ["NEW", "GOOD", "FAIR", "NEEDS_REPAIR", "DAMAGED"];

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().max(40).optional(),
  category: z.enum(CATEGORIES).default("OTHER"),
  serialNumber: z.string().trim().max(100).optional(),
  purchaseDate: z.string().date().optional(),
  purchaseRateRupees: z.number().positive().optional(),
  condition: z.enum(CONDITIONS).default("GOOD"),
  notes: z.string().trim().max(500).optional()
});
const updateSchema = createSchema.partial();

const assignSchema = z.object({
  equipmentId: z.string().min(1),
  siteId: z.string().min(1),
  assignedTo: z.string().trim().max(120).optional(),
  dateAssigned: z.string().date().optional(),
  conditionOut: z.enum(CONDITIONS).optional(),
  note: z.string().trim().max(500).optional()
});
const returnSchema = z.object({
  conditionIn: z.enum(CONDITIONS).optional(),
  note: z.string().trim().max(500).optional()
});

equipmentRouter.post("/", requirePermission("equipment.create"), asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  const eq = await EquipmentService.create(input, req.auth.userId);
  res.status(201).json({ success: true, data: eq });
}));

equipmentRouter.get("/", requirePermission("equipment.read"), asyncHandler(async (req, res) => {
  const query = z.object({
    status: z.enum(["AVAILABLE", "ASSIGNED", "IN_REPAIR", "RETIRED"]).optional(),
    site: z.string().optional(),
    search: z.string().optional()
  }).parse(req.query);
  const list = await EquipmentService.list(query);
  res.json({ success: true, data: list });
}));

equipmentRouter.get("/:id", requirePermission("equipment.read"), asyncHandler(async (req, res) => {
  const eq = await EquipmentService.get(req.params.id);
  res.json({ success: true, data: eq });
}));

equipmentRouter.patch("/:id", requirePermission("equipment.update"), asyncHandler(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const eq = await EquipmentService.update(req.params.id, input, req.auth.userId);
  res.json({ success: true, data: eq });
}));

equipmentRouter.delete("/:id", requirePermission("equipment.update"), asyncHandler(async (req, res) => {
  const r = await EquipmentService.remove(req.params.id, req.auth.userId);
  res.json({ success: true, data: r });
}));

equipmentRouter.post("/assign", requirePermission("equipment.assign"), asyncHandler(async (req, res) => {
  const input = assignSchema.parse(req.body);
  const a = await EquipmentService.assign(input, req.auth.userId);
  res.status(201).json({ success: true, data: a });
}));

equipmentRouter.post("/assignments/:id/return", requirePermission("equipment.assign"), asyncHandler(async (req, res) => {
  const input = returnSchema.parse(req.body);
  const a = await EquipmentService.returnEquipment(req.params.id, input, req.auth.userId);
  res.json({ success: true, data: a });
}));

equipmentRouter.get("/assignments/list", requirePermission("equipment.read"), asyncHandler(async (req, res) => {
  const query = z.object({
    site: z.string().optional(),
    active: z.string().optional()
  }).parse(req.query);
  const list = await EquipmentService.listAssignments(query);
  res.json({ success: true, data: list });
}));
