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
exports.FinanceService = {
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
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) query.date.$gte = new Date(filter.from);
      if (filter.to) query.date.$lte = new Date(filter.to);
    }
    return _Finance.FinancialTransaction.find(query).sort({
      date: -1
    });
  },
  async getSiteCapitalTotal(siteId) {
    const rows = await _Finance.SiteCapital.aggregate([{
      $match: {
        site: new (await import("mongoose")).Types.ObjectId(siteId)
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
   * Site profit/loss (§17 of spec): income - expenses, plus labour cost
   * pulled from the salary ledger (credits = wages earned on this site),
   * capital invested, and a net project position.
   */
  async getSiteProfitLoss(siteId) {
    const site = await _Site.Site.findById(siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const mongoose = await import("mongoose");
    const siteObjectId = new mongoose.Types.ObjectId(siteId);
    const [incomeAgg, expenseAgg, labourAgg, capitalTotal] = await Promise.all([_Finance.FinancialTransaction.aggregate([{
      $match: {
        site: siteObjectId,
        direction: "INCOME"
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
        direction: "EXPENSE"
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
        type: {
          $in: ["EARNING", "OVERTIME"]
        }
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
    }]), this.getSiteCapitalTotal(siteId)]);
    const incomePaise = incomeAgg[0]?.total ?? 0;
    const materialAndOtherExpensePaise = expenseAgg[0]?.total ?? 0;
    const labourCostPaise = Math.round(labourAgg[0]?.total ?? 0);
    const totalExpensePaise = (0, _utils.addPaise)(materialAndOtherExpensePaise, labourCostPaise);
    const profitLossPaise = (0, _utils.subtractPaise)(incomePaise, totalExpensePaise);
    return {
      siteId,
      siteName: site.name,
      income: (0, _utils.paiseToRupees)(incomePaise),
      materialAndOtherExpenses: (0, _utils.paiseToRupees)(materialAndOtherExpensePaise),
      labourCost: (0, _utils.paiseToRupees)(labourCostPaise),
      totalExpenses: (0, _utils.paiseToRupees)(totalExpensePaise),
      capitalInvested: (0, _utils.paiseToRupees)(capitalTotal),
      profitLoss: (0, _utils.paiseToRupees)(profitLossPaise)
    };
  },
  /** Company-wide profit/loss (§18 of spec), summed across all sites with optional filters. */
  async getCompanyProfitLoss(filter) {
    const dateFilter = {};
    if (filter.from || filter.to) {
      dateFilter.date = {};
      if (filter.from) dateFilter.date.$gte = new Date(filter.from);
      if (filter.to) dateFilter.date.$lte = new Date(filter.to);
    }
    const [incomeAgg, expenseAgg, labourAgg, capitalAgg] = await Promise.all([_Finance.FinancialTransaction.aggregate([{
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
        type: {
          $in: ["EARNING", "OVERTIME"]
        }
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
    }]), _Finance.SiteCapital.aggregate([{
      $group: {
        _id: null,
        total: {
          $sum: "$amountPaise"
        }
      }
    }])]);
    const incomePaise = incomeAgg[0]?.total ?? 0;
    const otherExpensePaise = expenseAgg[0]?.total ?? 0;
    const labourCostPaise = Math.round(labourAgg[0]?.total ?? 0);
    const totalExpensePaise = (0, _utils.addPaise)(otherExpensePaise, labourCostPaise);
    return {
      totalIncome: (0, _utils.paiseToRupees)(incomePaise),
      totalOtherExpenses: (0, _utils.paiseToRupees)(otherExpensePaise),
      totalLabourCost: (0, _utils.paiseToRupees)(labourCostPaise),
      totalExpenses: (0, _utils.paiseToRupees)(totalExpensePaise),
      totalCapital: (0, _utils.paiseToRupees)(capitalAgg[0]?.total ?? 0),
      totalProfit: (0, _utils.paiseToRupees)(Math.max(0, (0, _utils.subtractPaise)(incomePaise, totalExpensePaise))),
      totalLoss: (0, _utils.paiseToRupees)(Math.max(0, (0, _utils.subtractPaise)(totalExpensePaise, incomePaise)))
    };
  }
};