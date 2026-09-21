"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diaryRouter = void 0;
const express = require("express");
const { z } = require("zod");
const { DiaryService } = require("./diary.service");
const { authenticate } = require("../../middleware/authenticate");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../middleware/errorHandler");

const diaryRouter = exports.diaryRouter = express.Router();
diaryRouter.use(authenticate);

const WEATHER = ["SUNNY", "CLOUDY", "RAINY", "STORM", "EXTREME_HEAT", "OTHER"];
const photoSchema = z.object({
  fileId: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().max(200).optional()
});
const createSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().date(),
  weather: z.enum(WEATHER).default("SUNNY"),
  workDone: z.string().trim().min(2).max(5000),
  workersPresent: z.number().int().nonnegative().optional(),
  materialsReceived: z.string().trim().max(1000).optional(),
  issues: z.string().trim().max(1000).optional(),
  nextDayPlan: z.string().trim().max(1000).optional(),
  photos: z.array(photoSchema).optional()
});
const updateSchema = createSchema.omit({ siteId: true, date: true }).partial();

diaryRouter.post("/", requirePermission("diary.create"), asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  const entry = await DiaryService.create(input, req.auth.userId);
  res.status(201).json({ success: true, data: entry });
}));

diaryRouter.get("/", requirePermission("diary.read"), asyncHandler(async (req, res) => {
  const query = z.object({
    site: z.string().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional()
  }).parse(req.query);
  const list = await DiaryService.list(query);
  res.json({ success: true, data: list });
}));

diaryRouter.get("/:id", requirePermission("diary.read"), asyncHandler(async (req, res) => {
  const entry = await DiaryService.get(req.params.id);
  res.json({ success: true, data: entry });
}));

diaryRouter.patch("/:id", requirePermission("diary.update"), asyncHandler(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const entry = await DiaryService.update(req.params.id, input, req.auth.userId);
  res.json({ success: true, data: entry });
}));

diaryRouter.delete("/:id", requirePermission("diary.delete"), asyncHandler(async (req, res) => {
  const r = await DiaryService.remove(req.params.id, req.auth.userId);
  res.json({ success: true, data: r });
}));
