"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierRouter = void 0;
const express = require("express");
const { z } = require("zod");
const { SupplierService } = require("./supplier.service");
const { authenticate } = require("../../middleware/authenticate");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../middleware/errorHandler");

const supplierRouter = exports.supplierRouter = express.Router();
supplierRouter.use(authenticate);

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional(),
  gstin: z.string().trim().max(20).optional(),
  category: z.enum(["MATERIAL", "EQUIPMENT", "LABOUR_CONTRACTOR", "TRANSPORT", "OTHER"]).default("MATERIAL"),
  notes: z.string().trim().max(500).optional()
});
const updateSchema = createSchema.partial();

supplierRouter.post("/", requirePermission("supplier.create"), asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  const supplier = await SupplierService.create(input, req.auth.userId);
  res.status(201).json({ success: true, data: supplier });
}));

supplierRouter.get("/", requirePermission("supplier.read"), asyncHandler(async (req, res) => {
  const query = z.object({
    category: z.string().optional(),
    search: z.string().optional()
  }).parse(req.query);
  const suppliers = await SupplierService.list(query);
  res.json({ success: true, data: suppliers });
}));

supplierRouter.get("/:id", requirePermission("supplier.read"), asyncHandler(async (req, res) => {
  const s = await SupplierService.get(req.params.id);
  res.json({ success: true, data: s });
}));

supplierRouter.patch("/:id", requirePermission("supplier.update"), asyncHandler(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const s = await SupplierService.update(req.params.id, input, req.auth.userId);
  res.json({ success: true, data: s });
}));

supplierRouter.delete("/:id", requirePermission("supplier.delete"), asyncHandler(async (req, res) => {
  const r = await SupplierService.remove(req.params.id, req.auth.userId);
  res.json({ success: true, data: r });
}));
