Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.financeRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _finance = require("./finance.service");
var _financeExport = require("./financeExport");
var _AppError = require("../../errors/AppError");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _Finance = require("../../db/models/Finance");
const financeRouter = exports.financeRouter = (0, _express.Router)();
financeRouter.use(_authenticate.authenticate);

// --- Capital ---------------------------------------------------------

const addCapitalSchema = _zod.z.object({
  siteId: _zod.z.string().min(1),
  amountRupees: _zod.z.number().positive(),
  source: _zod.z.string().trim().min(2).max(200),
  date: _zod.z.string().date(),
  reference: _zod.z.string().optional()
});
financeRouter.post("/capital", (0, _rbac.requirePermission)("site.capital.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = addCapitalSchema.parse(req.body);
  const capital = await _finance.FinanceService.addCapital(input, req.auth.userId);
  const body = {
    success: true,
    data: capital
  };
  res.status(201).json(body);
}));

// --- Investments (admin puts money into a project/site) ----------------

const addInvestmentSchema = _zod.z.object({
  siteId: _zod.z.string().min(1),
  amountRupees: _zod.z.number().positive(),
  type: _zod.z.enum(_Finance.INVESTMENT_TYPES).default("CASH"),
  date: _zod.z.string().date(),
  reference: _zod.z.string().trim().max(200).optional(),
  note: _zod.z.string().trim().max(500).optional()
});
const manageInvestmentPermission = (0, _rbac.requireAnyPermission)("site.investment.manage", "site.capital.manage");
financeRouter.post("/investments", manageInvestmentPermission, (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = addInvestmentSchema.parse(req.body);
  const investment = await _finance.FinanceService.addInvestment(input, req.auth.userId);
  const body = {
    success: true,
    data: investment
  };
  res.status(201).json(body);
}));
financeRouter.get("/investments", (0, _rbac.requireAnyPermission)("financialReports.read", "site.investment.manage", "site.capital.manage"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    site: _zod.z.string().optional(),
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const investments = await _finance.FinanceService.listInvestments(query);
  const body = {
    success: true,
    data: investments
  };
  res.json(body);
}));
financeRouter.post("/investments/:id/reverse", manageInvestmentPermission, (0, _errorHandler.asyncHandler)(async (req, res) => {
  const reversal = await _finance.FinanceService.reverseInvestment(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: reversal
  };
  res.status(201).json(body);
}));

// --- Income / Expense --------------------------------------------------

const incomeSchema = _zod.z.object({
  siteId: _zod.z.string().min(1),
  category: _zod.z.enum(_Finance.FINANCE_CATEGORIES.INCOME),
  amountRupees: _zod.z.number().positive(),
  date: _zod.z.string().date(),
  description: _zod.z.string().trim().max(500).optional()
});
financeRouter.post("/income", (0, _rbac.requirePermission)("site.income.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = incomeSchema.parse(req.body);
  const transaction = await _finance.FinanceService.recordTransaction({
    ...input,
    direction: "INCOME"
  }, req.auth.userId);
  const body = {
    success: true,
    data: transaction
  };
  res.status(201).json(body);
}));
financeRouter.get("/income", (0, _rbac.requirePermission)("site.income.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    site: _zod.z.string().optional(),
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const transactions = await _finance.FinanceService.listTransactions({
    ...query,
    direction: "INCOME"
  });
  const body = {
    success: true,
    data: transactions
  };
  res.json(body);
}));
const expenseSchema = _zod.z.object({
  siteId: _zod.z.string().min(1),
  category: _zod.z.enum(_Finance.FINANCE_CATEGORIES.EXPENSE),
  amountRupees: _zod.z.number().positive(),
  date: _zod.z.string().date(),
  description: _zod.z.string().trim().max(500).optional()
});
financeRouter.post("/expenses", (0, _rbac.requirePermission)("site.expense.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = expenseSchema.parse(req.body);
  const transaction = await _finance.FinanceService.recordTransaction({
    ...input,
    direction: "EXPENSE"
  }, req.auth.userId);
  const body = {
    success: true,
    data: transaction
  };
  res.status(201).json(body);
}));
financeRouter.get("/expenses", (0, _rbac.requirePermission)("site.expense.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    site: _zod.z.string().optional(),
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const transactions = await _finance.FinanceService.listTransactions({
    ...query,
    direction: "EXPENSE"
  });
  const body = {
    success: true,
    data: transactions
  };
  res.json(body);
}));
financeRouter.post("/transactions/:id/reverse", (0, _rbac.requirePermission)("site.expense.delete"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const reversal = await _finance.FinanceService.reverseTransaction(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: reversal
  };
  res.status(201).json(body);
}));

// --- Profit / Loss -------------------------------------------------------

financeRouter.get("/site/:id/profit-loss", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const result = await _finance.FinanceService.getSiteProfitLoss(req.params.id, query);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));
financeRouter.get("/company/profit-loss", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const result = await _finance.FinanceService.getCompanyProfitLoss(query);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));

/**
 * Gross summary: EVERY site's total investment / income / total expenses /
 * profit-loss plus the company-wide gross totals (Σ across all sites).
 * Powers the Finance page's per-site table and gross profit/loss cards.
 */
financeRouter.get("/summary", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const result = await _finance.FinanceService.getGrossSummary(query);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));

/**
 * One file, sections kept apart: each worker's expenses, the worker-expense
 * total, total investment, total income, each site, then the gross.
 * format=pdf | doc | xls (docx/xlsx accepted as aliases).
 */
financeRouter.get("/export", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const first = (value) => Array.isArray(value) ? value[0] : value;
  const format = _financeExport.normalizeExportFormat(first(req.query.format) || "pdf");
  if (!format) {
    throw _AppError.AppError.validation("Choose a file type: PDF, Word (.doc), or Excel (.xls).");
  }
  const optionalDate = (value) => {
    const raw = first(value);
    return raw == null || raw === "" ? undefined : raw;
  };
  const query = _zod.z.object({
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse({
    from: optionalDate(req.query.from),
    to: optionalDate(req.query.to)
  });
  const report = await _finance.FinanceService.getFinancialExport(query);
  const file = _financeExport.renderFinancialExport(report, format);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Content-Length", file.buffer.length);
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).end(file.buffer);
}));

// --- Company expenses (office/admin, not site-specific) -----------------

const COMPANY_EXPENSE_CATEGORIES = ["OFFICE_RENT", "UTILITIES", "SALARIES_OFFICE", "TRAVEL", "MARKETING", "LEGAL", "ACCOUNTING", "INSURANCE", "MAINTENANCE", "OTHER"];
const companyExpenseSchema = _zod.z.object({
  category: _zod.z.enum(COMPANY_EXPENSE_CATEGORIES),
  amountRupees: _zod.z.number().positive(),
  date: _zod.z.string().date(),
  description: _zod.z.string().trim().max(500).optional(),
  paidTo: _zod.z.string().trim().max(200).optional(),
  reference: _zod.z.string().trim().max(200).optional()
});
financeRouter.post("/company-expenses", (0, _rbac.requirePermission)("company.expense.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = companyExpenseSchema.parse(req.body);
  const expense = await _finance.FinanceService.addCompanyExpense(input, req.auth.userId);
  res.status(201).json({ success: true, data: expense });
}));
financeRouter.get("/company-expenses", (0, _rbac.requireAnyPermission)("company.expense.read", "financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const expenses = await _finance.FinanceService.listCompanyExpenses(query);
  res.json({ success: true, data: expenses });
}));
financeRouter.post("/company-expenses/:id/reverse", (0, _rbac.requirePermission)("company.expense.delete"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const reversal = await _finance.FinanceService.reverseCompanyExpense(req.params.id, req.auth.userId);
  res.status(201).json({ success: true, data: reversal });
}));

// --- Site cash flow (worker payouts view) ------------------------------
financeRouter.get("/site/:id/cash-flow", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const query = _zod.z.object({
    from: _zod.z.string().date().optional(),
    to: _zod.z.string().date().optional()
  }).parse(req.query);
  const result = await _finance.FinanceService.getSiteCashFlow(req.params.id, query);
  res.json({ success: true, data: result });
}));

// --- Budget vs actual alerts -------------------------------------------
financeRouter.get("/budget-alerts", (0, _rbac.requirePermission)("financialReports.read"), (0, _errorHandler.asyncHandler)(async (_req, res) => {
  const alerts = await _finance.FinanceService.getBudgetAlerts();
  res.json({ success: true, data: alerts });
}));