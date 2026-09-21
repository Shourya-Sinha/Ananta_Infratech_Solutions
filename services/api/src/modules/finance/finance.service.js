Object.defineProperty(exports, "__esModule", {
  value: true
});
var _Finance = require("../../db/models/Finance");
var _SalaryLedger = require("../../db/models/SalaryLedger");
var _Site = require("../../db/models/Site");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _gateway = require("../../sockets/gateway");
var _sharedTypes = require("@ananta/shared-types");
var _utils = require("@ananta/utils");
var _mongoose = require("mongoose");
var _financeMath = require("./financeMath");

// Date-only filters represent calendar days. Using the end of the `to` day
// prevents a monthly report from dropping every transaction after midnight on
// its final day (which was especially visible for direct advance entries).
function buildDateFilter(filter) {
  if (!filter?.from && !filter?.to) return {};
  const date = {};
  if (filter.from) date.$gte = new Date(`${filter.from}T00:00:00.000Z`);
  if (filter.to) date.$lte = new Date(`${filter.to}T23:59:59.999Z`);
  return { date };
}

const PAYOUT_LEDGER_TYPES = ["ADVANCE_DEDUCTION", "KHARCHI_DEDUCTION"];

exports.FinanceService = {
  /**
   * ADMIN INVESTMENT (new): the admin puts money/material/equipment INTO a
   * project site. Distinct from income (what the site earns) and expenses
   * (what the site spends) — investments are summed per site into
   * "Total investment" on the Finance page and feed the per-site and gross
   * profit/loss calculations.
   */
  async addInvestment(input, actorId) {
    const site = await _Site.Site.findById(input.siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const investment = await _Finance.SiteInvestment.create({
      site: site._id,
      amountPaise: (0, _utils.rupeesToPaise)(input.amountRupees),
      type: input.type ?? "CASH",
      date: new Date(input.date),
      reference: input.reference,
      note: input.note,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "SITE_INVESTMENT_ADDED",
      targetType: "SiteInvestment",
      targetId: investment._id.toString(),
      after: {
        amountRupees: input.amountRupees,
        type: investment.type,
        site: site._id.toString()
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.SITE_INVESTMENT_ADDED, {
      siteId: site._id.toString(),
      investmentId: investment._id.toString()
    });

    // Investments affect the site's net position — broadcast the refreshed figure.
    const profitLoss = await this.getSiteProfitLoss(site._id.toString());
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.SITE_PROFIT_UPDATED, {
      siteId: site._id.toString(),
      profitLoss: profitLoss.profitLoss
    });
    return investment;
  },
  async listInvestments(filter) {
    const query = {};
    if (filter.site) query.site = filter.site;
    const dateFilter = buildDateFilter(filter);
    if (dateFilter.date) query.date = dateFilter.date;
    return _Finance.SiteInvestment.find(query).sort({
      date: -1
    });
  },
  /**
   * Reversal instead of delete (financial records are never hard-deleted —
   * same rule as FinancialTransaction). The reversal entry carries the same
   * positive amount with reversalOf set; aggregations subtract such entries,
   * so the site's total investment stays correct.
   */
  async reverseInvestment(investmentId, actorId) {
    const original = await _Finance.SiteInvestment.findById(investmentId);
    if (!original) throw _AppError.AppError.notFound("Investment not found");
    if (original.reversalOf) throw _AppError.AppError.validation("Cannot reverse a reversal entry.");
    const reversal = await _Finance.SiteInvestment.create({
      site: original.site,
      amountPaise: original.amountPaise,
      type: original.type,
      date: new Date(),
      reference: original.reference,
      note: `Reversal of investment ${original._id.toString()}`,
      createdBy: actorId,
      reversalOf: original._id
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "SITE_INVESTMENT_REVERSED",
      targetType: "SiteInvestment",
      targetId: reversal._id.toString(),
      before: {
        originalInvestmentId: original._id.toString()
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(original.site.toString())).emit(_sharedTypes.SOCKET_EVENTS.SITE_INVESTMENT_REVERSED, {
      siteId: original.site.toString(),
      investmentId: reversal._id.toString()
    });
    return reversal;
  },
  async addCapital(input, actorId) {
    const site = await _Site.Site.findById(input.siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const capital = await _Finance.SiteCapital.create({
      site: site._id,
      amountPaise: (0, _utils.rupeesToPaise)(input.amountRupees),
      source: input.source,
      date: new Date(input.date),
      reference: input.reference,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "SITE_CAPITAL_ADDED",
      targetType: "SiteCapital",
      targetId: capital._id.toString(),
      after: {
        amountRupees: input.amountRupees,
        site: site._id.toString()
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.SITE_CAPITAL_UPDATED, {
      siteId: site._id.toString()
    });
    return capital;
  },
  async recordTransaction(input, actorId) {
    const site = await _Site.Site.findById(input.siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const transaction = await _Finance.FinancialTransaction.create({
      site: site._id,
      direction: input.direction,
      category: input.category,
      amountPaise: (0, _utils.rupeesToPaise)(input.amountRupees),
      date: new Date(input.date),
      description: input.description,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: input.direction === "INCOME" ? "SITE_INCOME_ADDED" : "SITE_EXPENSE_ADDED",
      targetType: "FinancialTransaction",
      targetId: transaction._id.toString(),
      after: {
        amountRupees: input.amountRupees,
        category: input.category
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(input.direction === "INCOME" ? _sharedTypes.SOCKET_EVENTS.SITE_INCOME_ADDED : _sharedTypes.SOCKET_EVENTS.SITE_EXPENSE_ADDED, {
      siteId: site._id.toString(),
      transactionId: transaction._id.toString()
    });

    // Recompute + broadcast the updated profit figure so dashboards refresh live.
    const profitLoss = await this.getSiteProfitLoss(site._id.toString());
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.SITE_PROFIT_UPDATED, {
      siteId: site._id.toString(),
      profitLoss: profitLoss.profitLoss
    });
    return transaction;
  },
  /**
   * Reversal instead of delete (§16/§32 of spec: financial records are
   * never hard-deleted). Posts an equal-and-opposite transaction referencing
   * the original.
   */
  async reverseTransaction(transactionId, actorId) {
    const original = await _Finance.FinancialTransaction.findById(transactionId);
    if (!original) throw _AppError.AppError.notFound("Transaction not found");
    if (original.reversalOf) throw _AppError.AppError.validation("Cannot reverse a reversal entry.");
    const reversal = await _Finance.FinancialTransaction.create({
      site: original.site,
      direction: original.direction === "INCOME" ? "EXPENSE" : "INCOME",
      category: original.category,
      amountPaise: original.amountPaise,
      date: new Date(),
      description: `Reversal of transaction ${original._id.toString()}`,
      createdBy: actorId,
      reversalOf: original._id
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "FINANCIAL_TRANSACTION_REVERSED",
      targetType: "FinancialTransaction",
      targetId: reversal._id.toString(),
      before: {
        originalTransactionId: original._id.toString()
      }
    });
    return reversal;
  },
  async listTransactions(filter) {
    const query = {};
    if (filter.site) query.site = filter.site;
    if (filter.direction) query.direction = filter.direction;
    const dateFilter = buildDateFilter(filter);
    if (dateFilter.date) query.date = dateFilter.date;

    const transactions = await _Finance.FinancialTransaction.find(query).sort({
      date: -1
    });
    if (filter.direction !== "EXPENSE") return transactions;

    // Paid advances and Kharchi are stored in the salary ledger because they
    // also drive payroll deductions. Present them in the site's Expenses
    // feed as well, otherwise the totals and the transaction list disagree.
    const payoutQuery = {
      type: { $in: PAYOUT_LEDGER_TYPES },
      ...(filter.site ? { site: filter.site } : {}),
      ...(dateFilter.date ? { date: dateFilter.date } : {})
    };
    const payouts = await _SalaryLedger.SalaryLedger.find(payoutQuery)
      .populate("worker", "employeeId")
      .sort({ date: -1 });
    const payoutRows = payouts.map((payout) => ({
      _id: payout._id,
      date: payout.date,
      category: payout.type === "ADVANCE_DEDUCTION" ? "ADVANCE" : "KHARCHI",
      amountPaise: Number(payout.debitPaise?.toString?.() ?? payout.debitPaise ?? 0),
      description: payout.description,
      worker: payout.worker,
      site: payout.site,
      isWorkerPayout: true,
      reversalOf: null
    }));
    return [...transactions, ...payoutRows].sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  async getSiteCapitalTotal(siteId) {
    const rows = await _Finance.SiteCapital.aggregate([{
      $match: {
        site: new _mongoose.Types.ObjectId(siteId)
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: "$amountPaise"
        }
      }
    }]);
    return rows[0]?.total ?? 0;
  },
  /**
   * Total investment for a site: sum of admin SiteInvestment entries minus
   * any reversed ones (reversal entries carry reversalOf and are subtracted,
   * so amounts always stay positive in storage).
   */
  async getSiteInvestmentTotal(siteId) {
    const mongoose = _mongoose;
    const rows = await _Finance.SiteInvestment.aggregate([{
      $match: {
        site: new mongoose.Types.ObjectId(siteId)
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [{
              $ne: ["$reversalOf", null]
            }, {
              $multiply: ["$amountPaise", -1]
            }, "$amountPaise"]
          }
        }
      }
    }]);
    return Math.round(rows[0]?.total ?? 0);
  },
  /**
   * Site profit/loss (§17 of spec): income - expenses, plus labour cost
   * pulled from the salary ledger (credits = wages earned on this site),
   * paid worker payouts (advance/Kharchi debits), admin INVESTMENTS (new),
   * and a net project position.
   */
  /**
   * Build the date filter $match for a SalaryLedger aggregation. Note:
   * SalaryLedger `date` represents when the earning/deduction was actually
   * incurred, so applying a date range is correct for P&L — previously
   * the labour aggregations ignored this filter and produced inflated
   * numbers when used with a date range (bug fix).
   */
  _buildLabourMatch(siteId, dateFilter) {
    const match = {
      type: {
        $in: ["EARNING", "OVERTIME"]
      }
    };
    if (siteId) match.site = new _mongoose.Types.ObjectId(siteId);
    if (dateFilter.date) match.date = dateFilter.date;
    return match;
  },
  async getSiteProfitLoss(siteId, filter) {
    const site = await _Site.Site.findById(siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const mongoose = _mongoose;
    const siteObjectId = new mongoose.Types.ObjectId(siteId);
    const dateFilter = buildDateFilter(filter);
    const [incomeAgg, expenseAgg, labourAgg, payoutAgg, investmentAgg, investmentCount, capitalTotal] = await Promise.all([_Finance.FinancialTransaction.aggregate([{
      $match: {
        site: siteObjectId,
        direction: "INCOME",
        ...dateFilter
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: "$amountPaise"
        }
      }
    }]), _Finance.FinancialTransaction.aggregate([{
      $match: {
        site: siteObjectId,
        direction: "EXPENSE",
        ...dateFilter
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: "$amountPaise"
        }
      }
    }]), _SalaryLedger.SalaryLedger.aggregate([{
      $match: {
        site: siteObjectId,
        type: { $in: ["EARNING", "OVERTIME"] },
        ...(dateFilter.date ? { date: dateFilter.date } : {})
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: {
            $toDouble: "$creditPaise"
          }
        }
      }
    }]), _SalaryLedger.SalaryLedger.aggregate([{
      $match: {
        site: siteObjectId,
        type: { $in: PAYOUT_LEDGER_TYPES },
        ...(dateFilter.date ? { date: dateFilter.date } : {})
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: {
            $toDouble: "$debitPaise"
          }
        }
      }
    }]), _Finance.SiteInvestment.aggregate([{
      $match: {
        site: siteObjectId,
        ...dateFilter
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [{
              $ne: ["$reversalOf", null]
            }, {
              $multiply: ["$amountPaise", -1]
            }, "$amountPaise"]
          }
        }
      }
    }]), _Finance.SiteInvestment.countDocuments({
      site: siteObjectId,
      reversalOf: null
    }), this.getSiteCapitalTotal(siteId)]);
    const incomePaise = incomeAgg[0]?.total ?? 0;
    const materialAndOtherExpensePaise = expenseAgg[0]?.total ?? 0;
    const labourCostPaise = Math.round(labourAgg?.[0]?.total ?? 0);
    const workerPayoutPaise = Math.round(payoutAgg?.[0]?.total ?? 0);
    const investmentPaise = Math.round(investmentAgg?.[0]?.total ?? 0);
    // Shared pure math: totalExpenses, profitLoss (income − expenses) and
    // netPosition (profitLoss − investment) — see financeMath.js.
    const row = (0, _financeMath.computeSiteFinanceRow)({
      investmentPaise,
      incomePaise,
      expensePaise: materialAndOtherExpensePaise,
      labourPaise: labourCostPaise,
      workerPayoutPaise
    });
    return {
      siteId,
      siteName: site.name,
      income: (0, _utils.paiseToRupees)(row.incomePaise),
      materialAndOtherExpenses: (0, _utils.paiseToRupees)(row.expensePaise),
      labourCost: (0, _utils.paiseToRupees)(row.labourPaise),
      workerPayouts: (0, _utils.paiseToRupees)(row.workerPayoutPaise),
      totalExpenses: (0, _utils.paiseToRupees)(row.totalExpensesPaise),
      // NEW — admin investment for this site + position after recovering it:
      investment: (0, _utils.paiseToRupees)(row.investmentPaise),
      investmentCount,
      netPosition: (0, _utils.paiseToRupees)(row.netPositionPaise),
      // Kept for backwards compatibility with existing consumers (reports):
      capitalInvested: (0, _utils.paiseToRupees)(capitalTotal),
      profitLoss: (0, _utils.paiseToRupees)(row.profitLossPaise)
    };
  },
  /** Company-wide profit/loss (§18 of spec), summed across all sites with optional filters. */
  async getCompanyProfitLoss(filter = {}) {
    const dateFilter = buildDateFilter(filter);
    const [incomeAgg, expenseAgg, labourAgg, payoutAgg, capitalAgg, investmentAgg] = await Promise.all([_Finance.FinancialTransaction.aggregate([{
      $match: {
        direction: "INCOME",
        ...dateFilter
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: "$amountPaise"
        }
      }
    }]), _Finance.FinancialTransaction.aggregate([{
      $match: {
        direction: "EXPENSE",
        ...dateFilter
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: "$amountPaise"
        }
      }
    }]), _SalaryLedger.SalaryLedger.aggregate([{
      $match: {
        type: { $in: ["EARNING", "OVERTIME"] },
        ...(dateFilter.date ? { date: dateFilter.date } : {})
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: {
            $toDouble: "$creditPaise"
          }
        }
      }
    }]), _SalaryLedger.SalaryLedger.aggregate([{
      $match: {
        type: { $in: PAYOUT_LEDGER_TYPES },
        ...(dateFilter.date ? { date: dateFilter.date } : {})
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: {
            $toDouble: "$debitPaise"
          }
        }
      }
    }]), _Finance.SiteCapital.aggregate([{
      $group: {
        _id: null,
        total: {
          $sum: "$amountPaise"
        }
      }
    }]), _Finance.SiteInvestment.aggregate([{
      $match: {
        ...dateFilter
      }
    }, {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [{
              $ne: ["$reversalOf", null]
            }, {
              $multiply: ["$amountPaise", -1]
            }, "$amountPaise"]
          }
        }
      }
    }])]);
    const incomePaise = incomeAgg[0]?.total ?? 0;
    const otherExpensePaise = expenseAgg[0]?.total ?? 0;
    const labourCostPaise = Math.round(labourAgg?.[0]?.total ?? 0);
    const workerPayoutPaise = Math.round(payoutAgg?.[0]?.total ?? 0);
    const totalExpensePaise = (0, _utils.addPaise)(otherExpensePaise, labourCostPaise, workerPayoutPaise);
    return {
      totalIncome: (0, _utils.paiseToRupees)(incomePaise),
      totalOtherExpenses: (0, _utils.paiseToRupees)(otherExpensePaise),
      totalLabourCost: (0, _utils.paiseToRupees)(labourCostPaise),
      totalWorkerPayouts: (0, _utils.paiseToRupees)(workerPayoutPaise),
      totalExpenses: (0, _utils.paiseToRupees)(totalExpensePaise),
      totalCapital: (0, _utils.paiseToRupees)(capitalAgg[0]?.total ?? 0),
      // NEW — company-wide admin investment total:
      totalInvestment: (0, _utils.paiseToRupees)(Math.round(investmentAgg[0]?.total ?? 0)),
      totalProfit: (0, _utils.paiseToRupees)(Math.max(0, (0, _utils.subtractPaise)(incomePaise, totalExpensePaise))),
      totalLoss: (0, _utils.paiseToRupees)(Math.max(0, (0, _utils.subtractPaise)(totalExpensePaise, incomePaise)))
    };
  },
  /**
   * GROSS SUMMARY (new): per-site investment / income / expenses /
   * profit-loss rows for EVERY site, plus company-wide gross totals — this
   * powers the Finance page's "all sites" table and the gross profit/loss
   * KPI cards. Optional from/to filters apply to transactions, salary-ledger
   * labour, paid worker payouts and investments.
   */
  async getGrossSummary(filter = {}) {
    const dateFilter = buildDateFilter(filter);
    const [sites, txRows, labourRows, payoutRows, investmentRows] = await Promise.all([_Site.Site.find({}).select("name code status").sort({
      name: 1
    }).lean(), _Finance.FinancialTransaction.aggregate([{
      $match: {
        ...dateFilter
      }
    }, {
      $group: {
        _id: {
          site: "$site",
          direction: "$direction"
        },
        total: {
          $sum: "$amountPaise"
        }
      }
    }]), _SalaryLedger.SalaryLedger.aggregate([{
      $match: {
        type: { $in: ["EARNING", "OVERTIME"] },
        ...(dateFilter.date ? { date: dateFilter.date } : {})
      }
    }, {
      $group: {
        _id: "$site",
        total: {
          $sum: {
            $toDouble: "$creditPaise"
          }
        }
      }
    }]), _SalaryLedger.SalaryLedger.aggregate([{
      $match: {
        type: { $in: PAYOUT_LEDGER_TYPES },
        ...(dateFilter.date ? { date: dateFilter.date } : {})
      }
    }, {
      $group: {
        _id: "$site",
        total: {
          $sum: {
            $toDouble: "$debitPaise"
          }
        }
      }
    }]), _Finance.SiteInvestment.aggregate([{
      $match: {
        ...dateFilter
      }
    }, {
      $group: {
        _id: "$site",
        total: {
          $sum: {
            $cond: [{
              $ne: ["$reversalOf", null]
            }, {
              $multiply: ["$amountPaise", -1]
            }, "$amountPaise"]
          }
        }
      }
    }])]);
    const incomeBySite = new Map();
    const expenseBySite = new Map();
    for (const r of txRows) {
      const key = r._id.site?.toString();
      if (!key) continue;
      if (r._id.direction === "INCOME") incomeBySite.set(key, r.total);else expenseBySite.set(key, r.total);
    }
    const labourBySite = new Map((labourRows ?? []).map(r => [r._id?.toString(), Math.round(r.total)]));
    const payoutBySite = new Map((payoutRows ?? []).map(r => [r._id?.toString(), Math.round(r.total)]));
    const investmentBySite = new Map((investmentRows ?? []).map(r => [r._id?.toString(), Math.round(r.total)]));
    const paiseRows = [];
    const siteRows = sites.map(s => {
      const id = s._id.toString();
      const row = (0, _financeMath.computeSiteFinanceRow)({
        investmentPaise: investmentBySite.get(id) ?? 0,
        incomePaise: incomeBySite.get(id) ?? 0,
        expensePaise: expenseBySite.get(id) ?? 0,
        labourPaise: labourBySite.get(id) ?? 0,
        workerPayoutPaise: payoutBySite.get(id) ?? 0
      });
      paiseRows.push(row);
      return {
        siteId: id,
        siteName: s.name,
        siteCode: s.code,
        status: s.status,
        investment: (0, _utils.paiseToRupees)(row.investmentPaise),
        income: (0, _utils.paiseToRupees)(row.incomePaise),
        expenses: (0, _utils.paiseToRupees)(row.expensePaise),
        labourCost: (0, _utils.paiseToRupees)(row.labourPaise),
        workerPayouts: (0, _utils.paiseToRupees)(row.workerPayoutPaise),
        totalExpenses: (0, _utils.paiseToRupees)(row.totalExpensesPaise),
        profitLoss: (0, _utils.paiseToRupees)(row.profitLossPaise),
        netPosition: (0, _utils.paiseToRupees)(row.netPositionPaise)
      };
    });
    const totals = (0, _financeMath.computeGrossTotals)(paiseRows);
    return {
      sites: siteRows,
      totals: {
        totalInvestment: (0, _utils.paiseToRupees)(totals.investmentPaise),
        totalIncome: (0, _utils.paiseToRupees)(totals.incomePaise),
        totalOtherExpenses: (0, _utils.paiseToRupees)(totals.expensePaise),
        totalLabourCost: (0, _utils.paiseToRupees)(totals.labourPaise),
        totalWorkerPayouts: (0, _utils.paiseToRupees)(totals.workerPayoutPaise),
        totalExpenses: (0, _utils.paiseToRupees)(totals.totalExpensesPaise),
        grossProfit: (0, _utils.paiseToRupees)(totals.grossProfitPaise),
        grossLoss: (0, _utils.paiseToRupees)(totals.grossLossPaise),
        // The single company-wide figure: Σ(site income − site expenses).
        grossProfitLoss: (0, _utils.paiseToRupees)(totals.grossProfitLossPaise),
        // Everything after also recovering the invested capital:
        netPosition: (0, _utils.paiseToRupees)(totals.netPositionPaise),
        siteCount: sites.length
      }
    };
  },

  // --- Company expenses (office/admin, not site-specific) --------------
  async addCompanyExpense(input, actorId) {
    const expense = await _Finance.CompanyExpense.create({
      category: input.category,
      amountPaise: (0, _utils.rupeesToPaise)(input.amountRupees),
      date: new Date(input.date),
      description: input.description,
      paidTo: input.paidTo,
      reference: input.reference,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "COMPANY_EXPENSE_ADDED",
      targetType: "CompanyExpense",
      targetId: expense._id.toString(),
      after: { amountRupees: input.amountRupees, category: input.category }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.COMPANY_EXPENSE_ADDED, { expenseId: expense._id.toString() });
    return expense;
  },
  async reverseCompanyExpense(expenseId, actorId) {
    const original = await _Finance.CompanyExpense.findById(expenseId);
    if (!original) throw _AppError.AppError.notFound("Company expense not found");
    if (original.reversalOf) throw _AppError.AppError.validation("Cannot reverse a reversal entry.");
    const reversal = await _Finance.CompanyExpense.create({
      category: original.category,
      amountPaise: original.amountPaise,
      date: new Date(),
      description: `Reversal of company expense ${original._id.toString()}`,
      paidTo: original.paidTo,
      reference: original.reference,
      createdBy: actorId,
      reversalOf: original._id
    });
    await _audit.AuditService.log({ actor: actorId, action: "COMPANY_EXPENSE_REVERSED", targetType: "CompanyExpense", targetId: reversal._id.toString() });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.COMPANY_EXPENSE_REVERSED, { expenseId: reversal._id.toString() });
    return reversal;
  },
  async listCompanyExpenses(filter) {
    const query = {};
    const dateFilter = buildDateFilter(filter);
    if (dateFilter.date) query.date = dateFilter.date;
    return _Finance.CompanyExpense.find(query).sort({ date: -1 });
  },

  // --- Cash flow: actual cash paid OUT to workers (advances/kharchi/settlements) -
  // These are separate from accrual P&L labour cost. This answers the question
  // "show me the cash paid out on this site to workers this week/month".
  async getSiteCashFlow(siteId, filter) {
    const siteObjectId = new _mongoose.Types.ObjectId(siteId);
    const dateMatch = buildDateFilter(filter);
    // Worker payouts: salary ledger debits (ADVANCE_DEDUCTION / KHARCHI_DEDUCTION)
    // on this site = cash paid out as advances/kharchi.
    const payoutAgg = await _SalaryLedger.SalaryLedger.aggregate([{
      $match: {
        site: siteObjectId,
        type: { $in: ["ADVANCE_DEDUCTION", "KHARCHI_DEDUCTION"] },
        ...(dateMatch.date ? { date: dateMatch.date } : {})
      }
    }, {
      $group: {
        _id: "$type",
        total: { $sum: { $toDouble: "$debitPaise" } }
      }
    }]);
    let advancePaidPaise = 0;
    let kharchiPaidPaise = 0;
    for (const r of payoutAgg) {
      if (r._id === "ADVANCE_DEDUCTION") advancePaidPaise = Math.round(r.total);
      else if (r._id === "KHARCHI_DEDUCTION") kharchiPaidPaise = Math.round(r.total);
    }
    const totalPayoutPaise = (0, _utils.addPaise)(advancePaidPaise, kharchiPaidPaise);
    // Individual payout entries
    const payouts = await _SalaryLedger.SalaryLedger.find({
      site: siteObjectId,
      type: { $in: ["ADVANCE_DEDUCTION", "KHARCHI_DEDUCTION"] },
      ...(dateMatch.date ? { date: dateMatch.date } : {})
    }).populate("worker", "employeeId").sort({ date: -1 }).limit(200);
    return {
      siteId,
      advancePaid: (0, _utils.paiseToRupees)(advancePaidPaise),
      kharchiPaid: (0, _utils.paiseToRupees)(kharchiPaidPaise),
      totalPayoutToWorkers: (0, _utils.paiseToRupees)(totalPayoutPaise),
      payouts: payouts.map(p => ({
        _id: p._id,
        date: p.date,
        type: p.type,
        description: p.description,
        amount: (0, _utils.paiseToRupees)(Number(p.debitPaise.toString())),
        workerEmployeeId: p.worker?.employeeId,
        reference: p.reference
      }))
    };
  },

  // --- Budget vs Actual alerts ------------------------------------------
  async getBudgetAlerts() {
    const sites = await _Site.Site.find({ budgetPaise: { $gt: 0 } });
    const alerts = [];
    for (const site of sites) {
      const pnl = await this.getSiteProfitLoss(site._id.toString());
      const spent = (0, _utils.rupeesToPaise)(pnl.totalExpenses);
      const budget = site.budgetPaise;
      const utilizationPct = budget > 0 ? (spent / budget) * 100 : 0;
      let level = "OK";
      if (utilizationPct >= 100) level = "OVER_BUDGET";
      else if (utilizationPct >= 80) level = "WARNING";
      alerts.push({
        siteId: site._id.toString(),
        siteName: site.name,
        siteCode: site.code,
        budgetPaise: budget,
        budgetRupees: (0, _utils.paiseToRupees)(budget),
        spentPaise: spent,
        spentRupees: pnl.totalExpenses,
        utilizationPct: Math.round(utilizationPct * 10) / 10,
        level
      });
    }
    return alerts;
  }
};
