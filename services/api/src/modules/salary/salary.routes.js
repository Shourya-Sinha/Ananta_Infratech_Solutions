Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.salaryRouter = exports.payrollRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _salary = require("./salary.service");
var _statement = require("./statement");
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
    netSalary: (0, _utils.paiseToRupees)(payroll.netSalaryPaise),
    presentDays: payroll.presentDays ?? 0,
    halfDays: payroll.halfDays ?? 0,
    paidLeaveDays: payroll.paidLeaveDays ?? 0,
    unpaidLeaveDays: payroll.unpaidLeaveDays ?? 0,
    absentDays: payroll.absentDays ?? 0,
    overtimeHours: payroll.overtimeHours ?? 0
  };
  const body = {
    success: true,
    data
  };
  res.json(body);
}));
/**
 * Record-level access for a worker's salary data: a WORKER base may only see
 * their own profile; everyone else needs salary.read.
 */
async function assertCanViewWorkerSalary(req, workerId, message) {
  const {
    role,
    userId
  } = req.auth;
  // These routes have no requirePermission middleware, so req.auth.permissions
  // is the empty set authenticate() initialises — load the real set here or
  // every Manager/Admin was wrongly 403'd (only workers could pass).
  if (!req.auth.permissions || req.auth.permissions.size === 0) {
    const { PermissionService } = require("../permissions/permission.service");
    req.auth.permissions = await PermissionService.getPermissionsForRole(req.auth.roleKey ?? role);
  }
  const permissions = req.auth.permissions;
  if (role === "WORKER") {
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: userId
    });
    if (!profile || profile._id.toString() !== workerId) throw _AppError.AppError.forbidden(message);
  } else if (!permissions.has("salary.read")) {
    throw _AppError.AppError.forbidden();
  }
}
const statementQuery = _zod.z.object({
  month: _zod.z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM").optional()
});
salaryRouter.get("/worker/:id/statement", (0, _errorHandler.asyncHandler)(async (req, res) => {
  await assertCanViewWorkerSalary(req, req.params.id, "You can only view your own salary statement.");
  const {
    month
  } = statementQuery.parse(req.query);
  const data = await _salary.SalaryService.getStatement(req.params.id, month ?? (0, _statement.currentMonthIST)());
  res.json({
    success: true,
    data
  });
}));

// Convenience for the worker app: resolves the caller's own worker profile.
salaryRouter.get("/me/statement", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const profile = await _WorkerProfile.WorkerProfile.findOne({
    user: req.auth.userId
  }).select("_id");
  if (!profile) throw _AppError.AppError.notFound("No worker profile for this account.");
  const {
    month
  } = statementQuery.parse(req.query);
  const data = await _salary.SalaryService.getStatement(profile._id.toString(), month ?? (0, _statement.currentMonthIST)());
  res.json({
    success: true,
    data
  });
}));
// Salary preview: derived hourly/daily/monthly rates + today's earning +
// month-so-far + approximate full-month salary. Worker sees own; Manager /
// Admin (salary.read) can view any worker e.g. before marking attendance.
salaryRouter.get("/worker/:id/preview", (0, _errorHandler.asyncHandler)(async (req, res) => {
  await assertCanViewWorkerSalary(req, req.params.id, "You can only view your own salary preview.");
  const { month } = statementQuery.parse(req.query);
  const data = await _salary.SalaryService.getSalaryPreview(req.params.id, month ?? (0, _statement.currentMonthIST)());
  res.json({ success: true, data });
}));
salaryRouter.get("/me/preview", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const profile = await _WorkerProfile.WorkerProfile.findOne({ user: req.auth.userId }).select("_id");
  if (!profile) throw _AppError.AppError.notFound("No worker profile for this account.");
  const { month } = statementQuery.parse(req.query);
  const data = await _salary.SalaryService.getSalaryPreview(profile._id.toString(), month ?? (0, _statement.currentMonthIST)());
  res.json({ success: true, data });
}));
// Set a worker's pay rate in ONE basis; the API derives the other two.
// Manager (own site only) or Admin. Workers can never set their own rate.
const salaryRateSchema = _zod.z.object({
  mode: _zod.z.enum(["HOURLY", "DAILY", "MONTHLY"]),
  amountRupees: _zod.z.number().positive().max(10000000)
});
salaryRouter.put("/worker/:id/salary-rate", (0, _rbac.requirePermission)("salary.rate.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  if (req.auth.role === "WORKER") throw _AppError.AppError.forbidden("Workers cannot set salary rates.");
  const input = salaryRateSchema.parse(req.body);
  if (req.auth.role === "MANAGER") {
    const { Site } = require("../../db/models/Site");
    const profile = await _WorkerProfile.WorkerProfile.findById(req.params.id);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    const site = profile.currentSite ? await Site.findById(profile.currentSite) : null;
    if (!site || site.manager?.toString() !== req.auth.userId) throw _AppError.AppError.forbidden("You can only set rates for workers on your site.");
  }
  const rates = await _salary.SalaryService.setWorkerSalaryRate(req.params.id, input, req.auth.userId);
  const { AuditService } = require("../auditLogs/audit.service");
  await AuditService.log({ actor: req.auth.userId, action: "WORKER_SALARY_RATE_SET", targetType: "WorkerProfile", targetId: req.params.id, after: { ...input, rates } });
  res.json({ success: true, data: rates });
}));
// Salary payment receipts the worker can show as proof of payment.
salaryRouter.get("/me/receipts", (0, _errorHandler.asyncHandler)(async (req, res) => {
  const profile = await _WorkerProfile.WorkerProfile.findOne({ user: req.auth.userId }).select("_id");
  if (!profile) throw _AppError.AppError.notFound("No worker profile for this account.");
  const data = await _payroll.PayrollService.listWorkerReceipts(profile._id.toString());
  res.json({ success: true, data });
}));
salaryRouter.get("/worker/:id/receipts", (0, _errorHandler.asyncHandler)(async (req, res) => {
  await assertCanViewWorkerSalary(req, req.params.id, "You can only view your own salary receipts.");
  const data = await _payroll.PayrollService.listWorkerReceipts(req.params.id);
  res.json({ success: true, data });
}));
const payrollRouter = exports.payrollRouter = (0, _express.Router)();
payrollRouter.use(_authenticate.authenticate);
const monthParamSchema = _zod.z.object({
  month: _zod.z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
});
// --- Salary payment receipts + OCR (registered BEFORE /:month/* so
// "receipts" is never swallowed by the :month param) -----------------------
// OCR preview: client sends the text its OCR read from the receipt image;
// the API extracts amount / date / time / UPI transaction id for the admin
// to confirm. No image is stored by this endpoint.
payrollRouter.post("/receipts/ocr-preview", (0, _rbac.requireAnyPermission)("salary.receipt.manage", "salary.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const { text } = _zod.z.object({ text: _zod.z.string().min(1).max(20000) }).parse(req.body);
  const { parseReceiptText } = require("../payroll/receiptOcr");
  res.json({ success: true, data: parseReceiptText(text) });
}));
const receiptUpload = (() => {
  const multer = require("multer");
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
})();
const markWorkerPaidSchema = _zod.z.object({
  amountRupees: _zod.z.coerce.number().positive().optional(),
  method: _zod.z.enum(["UPI", "BANK_TRANSFER", "CASH", "CHEQUE", "OTHER"]).default("UPI"),
  transactionId: _zod.z.string().trim().max(64).optional(),
  paidAt: _zod.z.string().optional(),
  ocrText: _zod.z.string().max(20000).optional(),
  note: _zod.z.string().trim().max(500).optional()
});
// Mark ONE worker paid, optionally with the UPI/bank receipt image. When an
// image and/or ocrText is supplied, OCR fields are extracted and stored on
// the receipt; admin-confirmed fields always win over OCR guesses.
payrollRouter.post("/:month/workers/:workerId/mark-paid", (0, _rbac.requireAnyPermission)("salary.receipt.manage", "salary.manage"), receiptUpload.single("file"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const { month } = monthParamSchema.parse(req.params);
  const input = markWorkerPaidSchema.parse(req.body ?? {});
  const profile = await _WorkerProfile.WorkerProfile.findById(req.params.workerId);
  if (!profile) throw _AppError.AppError.notFound("Worker not found");
  const { parseReceiptText } = require("../payroll/receiptOcr");
  const ocr = input.ocrText ? parseReceiptText(input.ocrText) : null;
  let documentId;
  let receiptUrl;
  if (req.file) {
    const { DocumentService } = require("../documents/document.service");
    const doc = await DocumentService.uploadAndRecord({
      owner: profile.user.toString(),
      uploadedBy: req.auth.userId,
      type: "PAYMENT_PROOF",
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype
    });
    documentId = doc._id;
    receiptUrl = doc.url;
  }
  const hasReceiptData = Boolean(req.file || input.transactionId || input.amountRupees || ocr);
  const result = await _payroll.PayrollService.markWorkerPaid({
    workerId: req.params.workerId,
    month,
    receipt: hasReceiptData ? {
      amountPaise: input.amountRupees ? (0, _utils.rupeesToPaise)(input.amountRupees) : (ocr?.amountPaise ?? undefined),
      method: input.method,
      transactionId: input.transactionId ?? ocr?.transactionId ?? undefined,
      paidAt: input.paidAt ? new Date(input.paidAt) : (ocr?.paidAt ?? undefined),
      documentId,
      receiptUrl,
      ocr: ocr ? { rawText: input.ocrText, ...ocr } : undefined,
      note: input.note
    } : undefined
  }, req.auth.userId);
  res.status(201).json({ success: true, data: result });
}));
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