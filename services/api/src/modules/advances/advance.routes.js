Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.advancesRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _advance = require("./advance.service");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
var _validation = require("@ananta/validation");
const advancesRouter = exports.advancesRouter = (0, _express.Router)();
advancesRouter.use(_authenticate.authenticate);
advancesRouter.get("/", (0, _rbac.requirePermission)("advance.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    role,
    userId
  } = req.auth;
  let worker = typeof req.query.worker === "string" ? req.query.worker : undefined;
  if (role === "WORKER") {
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: userId
    });
    worker = profile?._id.toString();
  }
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const requests = await _advance.AdvanceService.list({
    worker,
    status
  });
  const body = {
    success: true,
    data: requests
  };
  res.json(body);
}));
advancesRouter.post("/", (0, _rbac.requirePermission)("advance.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = _validation.advanceCreateSchema.parse(req.body);

  // WORKER role can only submit for themselves; MANAGER can submit on behalf.
  if (req.auth.role === "WORKER") {
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: req.auth.userId
    });
    if (!profile || profile._id.toString() !== input.worker) {
      throw _AppError.AppError.forbidden("You can only submit advance requests for yourself.");
    }
  }
  const request = await _advance.AdvanceService.create({
    workerId: input.worker,
    amountRupees: input.amountRupees,
    reason: input.reason,
    requestedDate: input.requestedDate,
    attachmentFileId: input.attachmentFileId,
    submittedBy: req.auth.userId
  });
  const body = {
    success: true,
    data: request
  };
  res.status(201).json(body);
}));
// Super Admin direct add: creates an advance for ANY worker without a
// request. Auto-approves, and by default marks it paid in the same step so
// the salary deduction posts immediately (set markPaidNow:false to keep it
// APPROVED for a later /:id/mark-paid).
advancesRouter.post("/direct", (0, _rbac.requirePermission)("advance.directAdd"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = _validation.advanceDirectSchema.parse(req.body);
  const request = await _advance.AdvanceService.createDirect({
    workerId: input.worker,
    amountRupees: input.amountRupees,
    reason: input.reason,
    requestedDate: input.requestedDate,
    siteId: input.site,
    markPaidNow: input.markPaidNow,
    actorId: req.auth.userId
  });
  const body = {
    success: true,
    data: request
  };
  res.status(201).json(body);
}));
advancesRouter.post("/:id/approve", (0, _rbac.requirePermission)("advance.approve"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    approvedAmountRupees
  } = _validation.advanceApproveSchema.parse(req.body);
  const request = await _advance.AdvanceService.approve(req.params.id, approvedAmountRupees, req.auth.userId);
  const body = {
    success: true,
    data: request
  };
  res.json(body);
}));
advancesRouter.post("/:id/reject", (0, _rbac.requirePermission)("advance.reject"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    rejectionReason
  } = _validation.advanceRejectSchema.parse(req.body);
  const request = await _advance.AdvanceService.reject(req.params.id, rejectionReason, req.auth.userId);
  const body = {
    success: true,
    data: request
  };
  res.json(body);
}));
const markPaidSchema = _zod.z.object({
  // Optional: falls back to the worker's current site for the salary-ledger
  // entry, so the web UI can complete the advance → deduction flow without a
  // site picker when the worker is already assigned to a site.
  siteId: _zod.z.string().min(1).optional()
});
advancesRouter.post("/:id/mark-paid", (0, _rbac.requirePermission)("advance.approve"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    siteId
  } = markPaidSchema.parse(req.body);
  const request = await _advance.AdvanceService.markPaid(req.params.id, siteId, req.auth.userId);
  const body = {
    success: true,
    data: request
  };
  res.json(body);
}));
advancesRouter.post("/:id/cancel", (0, _rbac.requirePermission)("advance.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const request = await _advance.AdvanceService.cancel(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: request
  };
  res.json(body);
}));