"use strict";

/**
 * Company updates: Announcements + Holidays (Admin-controlled content the
 * whole company sees in the app) and Leave requests (worker → manager/admin
 * approval → attendance + salary). All content is controlled by Admin;
 * Managers can approve leave only for workers on their own sites.
 */
const { Router } = require("express");
const { z } = require("zod");
const { Announcement, Holiday, LeaveRequest } = require("../../db/models/Notice");
const { WorkerProfile } = require("../../db/models/WorkerProfile");
const { Site } = require("../../db/models/Site");
const { authenticate } = require("../../middleware/authenticate");
const { requirePermission, requireAnyPermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../middleware/errorHandler");
const { AppError } = require("../../errors/AppError");
const { AuditService } = require("../auditLogs/audit.service");
const { NotificationService } = require("../notifications/notification.service");
const { AttendanceService } = require("../attendance/attendance.service");

const router = Router();
router.use(authenticate);

// ---------------- Announcements -------------------------------------------
function audienceFor(role) {
  return role === "WORKER" ? ["ALL", "WORKERS"] : role === "MANAGER" ? ["ALL", "MANAGERS"] : ["ALL", "WORKERS", "MANAGERS"];
}

router.get("/announcements", requirePermission("announcement.read"), asyncHandler(async (req, res) => {
  const now = new Date();
  const items = await Announcement.find({
    isActive: true,
    audience: { $in: audienceFor(req.auth.role) },
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
  }).sort({ pinned: -1, createdAt: -1 }).limit(100);
  res.json({ success: true, data: items });
}));

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(4000),
  audience: z.enum(["ALL", "WORKERS", "MANAGERS"]).default("ALL"),
  pinned: z.boolean().default(false),
  expiresAt: z.string().optional()
});
router.post("/announcements", requirePermission("announcement.manage"), asyncHandler(async (req, res) => {
  const input = announcementSchema.parse(req.body);
  const doc = await Announcement.create({ ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined, createdBy: req.auth.userId });
  await AuditService.log({ actor: req.auth.userId, action: "ANNOUNCEMENT_CREATED", targetType: "Announcement", targetId: doc._id.toString(), after: { title: doc.title, audience: doc.audience } });
  res.status(201).json({ success: true, data: doc });
}));
// Admin management list includes inactive/expired items.
router.get("/announcements/manage", requirePermission("announcement.manage"), asyncHandler(async (_req, res) => {
  const items = await Announcement.find({}).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data: items });
}));
router.patch("/announcements/:id", requirePermission("announcement.manage"), asyncHandler(async (req, res) => {
  const input = announcementSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  const doc = await Announcement.findByIdAndUpdate(req.params.id, { ...input, ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}) }, { new: true });
  if (!doc) throw AppError.notFound("Announcement not found");
  res.json({ success: true, data: doc });
}));
router.delete("/announcements/:id", requirePermission("announcement.manage"), asyncHandler(async (req, res) => {
  const doc = await Announcement.findByIdAndDelete(req.params.id);
  if (!doc) throw AppError.notFound("Announcement not found");
  await AuditService.log({ actor: req.auth.userId, action: "ANNOUNCEMENT_DELETED", targetType: "Announcement", targetId: req.params.id });
  res.json({ success: true, data: { deleted: true } });
}));

// ---------------- Holidays -------------------------------------------------
router.get("/holidays", requirePermission("announcement.read"), asyncHandler(async (req, res) => {
  const query = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).parse(req.query);
  const filter = {};
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = new Date(query.from);
    if (query.to) filter.date.$lte = new Date(query.to);
  }
  const items = await Holiday.find(filter).sort({ date: 1 }).limit(366);
  res.json({ success: true, data: items });
}));
const holidaySchema = z.object({
  name: z.string().trim().min(2).max(120),
  date: z.string().date(),
  note: z.string().trim().max(300).optional()
});
router.post("/holidays", requirePermission("holiday.manage"), asyncHandler(async (req, res) => {
  const input = holidaySchema.parse(req.body);
  const doc = await Holiday.create({ name: input.name, date: new Date(input.date), note: input.note, createdBy: req.auth.userId });
  await AuditService.log({ actor: req.auth.userId, action: "HOLIDAY_CREATED", targetType: "Holiday", targetId: doc._id.toString(), after: { name: doc.name, date: input.date } });
  res.status(201).json({ success: true, data: doc });
}));
router.delete("/holidays/:id", requirePermission("holiday.manage"), asyncHandler(async (req, res) => {
  const doc = await Holiday.findByIdAndDelete(req.params.id);
  if (!doc) throw AppError.notFound("Holiday not found");
  res.json({ success: true, data: { deleted: true } });
}));

// ---------------- Leave requests -------------------------------------------
const leaveSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
  leaveType: z.enum(["PAID", "UNPAID"]).default("PAID"),
  reason: z.string().trim().max(500).optional()
}).refine((v) => v.toDate >= v.fromDate, { message: "toDate must be on or after fromDate", path: ["toDate"] });

router.post("/leaves", requirePermission("leave.create"), asyncHandler(async (req, res) => {
  if (req.auth.role !== "WORKER") throw AppError.validation("Only workers request leave here. Managers/Admin record leave via attendance.");
  const input = leaveSchema.parse(req.body);
  const profile = await WorkerProfile.findOne({ user: req.auth.userId });
  if (!profile) throw AppError.notFound("No worker profile for this account.");
  const overlap = await LeaveRequest.findOne({
    worker: profile._id, status: { $in: ["REQUESTED", "APPROVED"] },
    fromDate: { $lte: new Date(input.toDate) }, toDate: { $gte: new Date(input.fromDate) }
  });
  if (overlap) throw AppError.conflict("You already have a leave request covering these dates.");
  const doc = await LeaveRequest.create({ worker: profile._id, fromDate: new Date(input.fromDate), toDate: new Date(input.toDate), leaveType: input.leaveType, reason: input.reason });
  await AuditService.log({ actor: req.auth.userId, action: "LEAVE_REQUESTED", targetType: "LeaveRequest", targetId: doc._id.toString(), after: input });
  res.status(201).json({ success: true, data: doc });
}));

router.get("/leaves", requireAnyPermission("leave.create", "leave.approve"), asyncHandler(async (req, res) => {
  const { role, userId } = req.auth;
  if (role === "WORKER") {
    const profile = await WorkerProfile.findOne({ user: userId }).select("_id");
    if (!profile) return res.json({ success: true, data: [] });
    const items = await LeaveRequest.find({ worker: profile._id }).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: items });
  }
  let workerFilter = {};
  if (role === "MANAGER") {
    const sites = await Site.find({ manager: userId }).select("_id");
    const workers = await WorkerProfile.find({ currentSite: { $in: sites.map((s) => s._id) } }).select("_id");
    workerFilter = { worker: { $in: workers.map((w) => w._id) } };
  }
  const items = await LeaveRequest.find(workerFilter)
    .populate({ path: "worker", select: "employeeId user currentSite", populate: { path: "user", select: "name phone" } })
    .sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data: items });
}));

const decideSchema = z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional() });
router.post("/leaves/:id/decide", requirePermission("leave.approve"), asyncHandler(async (req, res) => {
  const input = decideSchema.parse(req.body);
  const doc = await LeaveRequest.findById(req.params.id);
  if (!doc) throw AppError.notFound("Leave request not found");
  if (doc.status !== "REQUESTED") throw AppError.conflict(`This leave is already ${doc.status}.`);
  const profile = await WorkerProfile.findById(doc.worker);
  if (!profile) throw AppError.notFound("Worker not found");
  if (req.auth.role === "MANAGER") {
    const site = profile.currentSite ? await Site.findById(profile.currentSite) : null;
    if (!site || site.manager?.toString() !== req.auth.userId) throw AppError.forbidden("You can only decide leave for workers on your site.");
  }
  doc.status = input.approve ? "APPROVED" : "REJECTED";
  doc.decidedBy = req.auth.userId;
  doc.decisionNote = input.note;

  let attendanceCreated = 0;
  if (input.approve) {
    if (!profile.currentSite) throw AppError.validation("Worker has no site assigned; assign a site before approving leave.");
    // One attendance record per day via the normal pipeline: paid leave is
    // credited as a full day of salary, unpaid leave earns nothing, and any
    // day already marked is left untouched (never double-marked).
    const cursor = new Date(doc.fromDate);
    const end = new Date(doc.toDate);
    let guard = 0;
    while (cursor <= end && guard < 62) {
      guard += 1;
      const dateStr = cursor.toISOString().slice(0, 10);
      try {
        await AttendanceService.record(
          { worker: profile._id.toString(), site: profile.currentSite.toString(), date: dateStr, status: doc.leaveType === "PAID" ? "LEAVE_PAID" : "LEAVE_UNPAID", hoursWorked: 0, overtimeHours: 0 },
          req.auth.userId, req.auth.role
        );
        attendanceCreated += 1;
      } catch (err) {
        if (err?.code !== "CONFLICT") throw err; // already marked that day — skip
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  doc.attendanceCreated = attendanceCreated;
  await doc.save();
  await AuditService.log({ actor: req.auth.userId, action: input.approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED", targetType: "LeaveRequest", targetId: doc._id.toString(), after: { attendanceCreated } });
  await NotificationService.send({
    recipient: profile.user.toString(),
    type: input.approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
    title: input.approve ? "Your leave was approved" : "Your leave was rejected",
    body: `${doc.fromDate.toISOString().slice(0, 10)} → ${doc.toDate.toISOString().slice(0, 10)} (${doc.leaveType})${input.note ? ` — ${input.note}` : ""}`
  });
  res.json({ success: true, data: doc });
}));

router.post("/leaves/:id/cancel", asyncHandler(async (req, res) => {
  const doc = await LeaveRequest.findById(req.params.id);
  if (!doc) throw AppError.notFound("Leave request not found");
  const profile = await WorkerProfile.findOne({ user: req.auth.userId }).select("_id");
  if (!profile || doc.worker.toString() !== profile._id.toString()) throw AppError.forbidden("You can only cancel your own leave.");
  if (doc.status !== "REQUESTED") throw AppError.conflict("Only a pending leave can be cancelled.");
  doc.status = "CANCELLED";
  await doc.save();
  res.json({ success: true, data: doc });
}));

exports.companyRouter = router;
