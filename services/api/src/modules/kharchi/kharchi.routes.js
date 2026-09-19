Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kharchiRouter = void 0;
var _express = require("express");
var _kharchi = require("./kharchi.service");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
var _validation = require("@ananta/validation");
const kharchiRouter = exports.kharchiRouter = (0, _express.Router)();
kharchiRouter.use(_authenticate.authenticate);
kharchiRouter.get("/", (0, _rbac.requirePermission)("kharchi.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
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
  const site = typeof req.query.site === "string" ? req.query.site : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const requests = await _kharchi.KharchiService.list({
    worker,
    site,
    status
  });
  const body = {
    success: true,
    data: requests
  };
  res.json(body);
}));
kharchiRouter.post("/", (0, _rbac.requirePermission)("kharchi.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = _validation.kharchiCreateSchema.parse(req.body);
  if (req.auth.role === "WORKER") {
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: req.auth.userId
    });
    if (!profile || profile._id.toString() !== input.worker) {
      throw _AppError.AppError.forbidden("You can only submit Kharchi requests for yourself.");
    }
  }
  const request = await _kharchi.KharchiService.create({
    workerId: input.worker,
    siteId: input.site,
    amountRupees: input.amountRupees,
    date: input.date,
    category: input.category,
    reason: input.reason,
    submittedBy: req.auth.userId
  });
  const body = {
    success: true,
    data: request
  };
  res.status(201).json(body);
}));
kharchiRouter.post("/:id/approve", (0, _rbac.requirePermission)("kharchi.approve"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const request = await _kharchi.KharchiService.approve(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: request
  };
  res.json(body);
}));
kharchiRouter.post("/:id/reject", (0, _rbac.requirePermission)("kharchi.reject"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    rejectionReason
  } = _validation.kharchiRejectSchema.parse(req.body);
  const request = await _kharchi.KharchiService.reject(req.params.id, rejectionReason, req.auth.userId);
  const body = {
    success: true,
    data: request
  };
  res.json(body);
}));