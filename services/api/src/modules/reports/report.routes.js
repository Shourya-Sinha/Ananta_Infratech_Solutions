Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.reportsRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _report = require("./report.service");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
const reportsRouter = exports.reportsRouter = (0, _express.Router)();
reportsRouter.use(_authenticate.authenticate);
function respondReport(req, res, data) {
  const format = typeof req.query.format === "string" ? req.query.format : "json";
  if (format === "csv") {
    const csv = _report.ReportService.toCsv(data);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="report.csv"`);
    return res.send(csv);
  }
  const body = {
    success: true,
    data
  };
  res.json(body);
}
reportsRouter.get("/attendance", (0, _rbac.requirePermission)("attendance.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    site: _zod.z.string().optional(),
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const data = await _report.ReportService.attendanceReport(query);
  respondReport(req, res, data);
}));
reportsRouter.get("/payroll", (0, _rbac.requirePermission)("salary.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    month
  } = _zod.z.object({
    month: _zod.z.string().regex(/^\d{4}-\d{2}$/)
  }).parse(req.query);
  const data = await _report.ReportService.payrollReport(month);
  respondReport(req, res, data);
}));
reportsRouter.get("/site-finance", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    site
  } = _zod.z.object({
    site: _zod.z.string().min(1)
  }).parse(req.query);
  const data = await _report.ReportService.siteFinanceReport(site);
  respondReport(req, res, data);
}));
reportsRouter.get("/:type/export", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, _res) => {
  throw _AppError.AppError.validation(`Use the dedicated /reports/${req.params.type}?format=csv endpoint instead of this generic path.`);
}));