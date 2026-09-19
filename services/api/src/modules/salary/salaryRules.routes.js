Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.salaryRulesRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _salaryRule = require("./salaryRule.service");
var _audit = require("../auditLogs/audit.service");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
const salaryRulesRouter = exports.salaryRulesRouter = (0, _express.Router)();
salaryRulesRouter.use(_authenticate.authenticate);

/** Current active payroll rule set (§10/§46 of spec: admin-configurable, not hardcoded). */
salaryRulesRouter.get("/", (0, _rbac.requirePermission)("salary.manage"), (0, _errorHandler.asyncHandler)(async (_req, res) => {
  const rules = await _salaryRule.SalaryRuleService.getActiveRuleSet();
  const body = {
    success: true,
    data: rules
  };
  res.json(body);
}));
const updateSchema = _zod.z.object({
  fullDayHours: _zod.z.number().min(1).max(24).optional(),
  overtimeStartHours: _zod.z.number().min(1).max(24).optional(),
  overtimeMultiplier: _zod.z.number().min(0.5).max(5).optional()
});
salaryRulesRouter.patch("/", (0, _rbac.requirePermission)("salary.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const actorId = req.auth.userId;
  if (input.fullDayHours !== undefined) await _salaryRule.SalaryRuleService.setRule("FULL_DAY_HOURS", input.fullDayHours, actorId);
  if (input.overtimeStartHours !== undefined) await _salaryRule.SalaryRuleService.setRule("OVERTIME_START_HOURS", input.overtimeStartHours, actorId);
  if (input.overtimeMultiplier !== undefined) await _salaryRule.SalaryRuleService.setRule("OVERTIME_MULTIPLIER", input.overtimeMultiplier, actorId);
  await _audit.AuditService.log({
    actor: actorId,
    action: "SALARY_RULES_UPDATED",
    targetType: "SalaryRule",
    targetId: "global",
    after: input
  });
  const rules = await _salaryRule.SalaryRuleService.getActiveRuleSet();
  const body = {
    success: true,
    data: rules
  };
  res.json(body);
}));