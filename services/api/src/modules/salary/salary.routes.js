Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.salaryRouter = exports.payrollRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _salary = require("./salary.service");
var _payroll = require("../payroll/payroll.service");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
var _utils = require("@ananta/utils");
const salaryRouter = exports.salaryRouter = (0, _express.Router)();
salaryRouter.use(_authenticate.authenticate);

// A worker can view their own ledger even without the general salary.read
// permission — record-level self-access, checked here rather than via RBAC.
salaryRouter.get("/worker/:id/ledger", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    role,
    userId,
    permissions
  } = req.auth;
  if (role === "WORKER") {
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: userId
    });
    if (!profile || profile._id.toString() !== req.params.id) {
      throw _AppError.AppError.forbidden("You can only view your own salary ledger.");
    }
  } else if (!permissions.has("salary.read")) {
    throw _AppError.AppError.forbidden();
  }
  const query = _zod.z.object({
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const ledger = await _salary.SalaryService.getLedger(req.params.id, query.from ? new Date(query.from) : undefined, query.to ? new Date(query.to) : undefined);
  const data = ledger.map(e => ({
    id: e._id.toString(),
    date: e.date,
    type: e.type,
    description: e.description,
    credit: (0, _utils.paiseToRupees)(Number(e.creditPaise.toString())),
    debit: (0, _utils.paiseToRupees)(Number(e.debitPaise.toString())),
    runningBalance: (0, _utils.paiseToRupees)(Number(e.runningBalancePaise.toString()))
  }));
  const body = {
    success: true,
    data
  };
  res.json(body);
}));
salaryRouter.get("/worker/:id/summary", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    role,
    userId,
    permissions
  } = req.auth;
  if (role === "WORKER") {
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: userId
    });
    if (!profile || profile._id.toString() !== req.params.id) {
      throw _AppError.AppError.forbidden("You can only view your own salary summary.");
    }
  } else if (!permissions.has("salary.read")) {
    throw _AppError.AppError.forbidden();
  }
  const {
    month
  } = _zod.z.object({
    month: _zod.z.string().regex(/^\d{4}-\d{2}$/)
  }).parse(req.query);
  const payroll = await _payroll.PayrollService.getWorkerMonth(req.params.id, month);
  const data = {
    month,
    status: payroll.status,
    grossEarnings: (0, _utils.paiseToRupees)(payroll.grossEarningsPaise),
    overtimeEarnings: (0, _utils.paiseToRupees)(payroll.overtimeEarningsPaise),
    advanceDeductions: (0, _utils.paiseToRupees)(payroll.advanceDeductionsPaise),
    kharchiDeductions: (0, _utils.paiseToRupees)(payroll.kharchiDeductionsPaise),
    otherDeductions: (0, _utils.paiseToRupees)(payroll.otherDeductionsPaise),
    netSalary: (0, _utils.paiseToRupees)(payroll.netSalaryPaise)
  };
  const body = {
    success: true,
    data
  };
  res.json(body);
}));
const payrollRouter = exports.payrollRouter = (0, _express.Router)();
payrollRouter.use(_authenticate.authenticate);
const monthParamSchema = _zod.z.object({
  month: _zod.z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
});
payrollRouter.post("/:month/calculate", (0, _rbac.requirePermission)("salary.calculate"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    month
  } = monthParamSchema.parse(req.params);
  const results = await _payroll.PayrollService.calculateMonth(month, req.auth.userId);
  const body = {
    success: true,
    data: results
  };
  res.json(body);
}));
payrollRouter.get("/:month", (0, _rbac.requirePermission)("salary.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    month
  } = monthParamSchema.parse(req.params);
  const payrolls = await _payroll.PayrollService.getMonth(month);
  const body = {
    success: true,
    data: payrolls
  };
  res.json(body);
}));
payrollRouter.post("/:month/finalize", (0, _rbac.requirePermission)("salary.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    month
  } = monthParamSchema.parse(req.params);
  const result = await _payroll.PayrollService.finalizeMonth(month, req.auth.userId);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));
payrollRouter.post("/:month/mark-paid", (0, _rbac.requirePermission)("salary.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    month
  } = monthParamSchema.parse(req.params);
  const result = await _payroll.PayrollService.markPaid(month, req.auth.userId);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));
const adjustmentSchema = _zod.z.object({
  workerId: _zod.z.string().min(1),
  siteId: _zod.z.string().min(1),
  amountRupees: _zod.z.number().refine(v => v !== 0, "amount cannot be zero"),
  description: _zod.z.string().trim().min(3).max(300)
});
payrollRouter.post("/adjustments", (0, _rbac.requirePermission)("salary.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = adjustmentSchema.parse(req.body);
  const entry = await _payroll.PayrollService.postAdjustment({
    workerId: input.workerId,
    siteId: input.siteId,
    amountPaise: (0, _utils.rupeesToPaise)(input.amountRupees),
    description: input.description,
    actorId: req.auth.userId
  });
  const body = {
    success: true,
    data: entry
  };
  res.status(201).json(body);
}));