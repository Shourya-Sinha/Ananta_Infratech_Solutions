Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.computeSiteFinanceRow = computeSiteFinanceRow;
exports.computeGrossTotals = computeGrossTotals;
var _utils = require("@ananta/utils");
/**
 * PURE finance math for the investment / profit-loss feature (no DB access,
 * no Mongoose — so it is unit-testable in isolation, see
 * tests/unit/financeSummary.test.js). All inputs/outputs are INTEGER paise.
 *
 * Definitions used across the Finance page and API:
 *   totalExpenses = materialAndOtherExpenses + labourCost
 *   profitLoss    = income − totalExpenses            (operating P/L of the site)
 *   netPosition   = profitLoss − investment           (P/L after recovering what
 *                                                      the admin invested)
 *   grossProfitLoss = Σ site profitLoss across all sites (company gross figure)
 */

function computeSiteFinanceRow(partials) {
  const investmentPaise = partials.investmentPaise ?? 0;
  const incomePaise = partials.incomePaise ?? 0;
  const expensePaise = partials.expensePaise ?? 0;
  const labourPaise = partials.labourPaise ?? 0;
  const totalExpensesPaise = (0, _utils.addPaise)(expensePaise, labourPaise);
  const profitLossPaise = (0, _utils.subtractPaise)(incomePaise, totalExpensesPaise);
  const netPositionPaise = (0, _utils.subtractPaise)(profitLossPaise, investmentPaise);
  return {
    investmentPaise,
    incomePaise,
    expensePaise,
    labourPaise,
    totalExpensesPaise,
    profitLossPaise,
    netPositionPaise
  };
}

/** Sums any number of per-site rows (as returned by computeSiteFinanceRow) into company gross totals. */
function computeGrossTotals(siteRows) {
  const totals = {
    investmentPaise: 0,
    incomePaise: 0,
    expensePaise: 0,
    labourPaise: 0,
    totalExpensesPaise: 0,
    grossProfitPaise: 0,
    grossLossPaise: 0,
    grossProfitLossPaise: 0,
    netPositionPaise: 0
  };
  for (const row of siteRows) {
    totals.investmentPaise = (0, _utils.addPaise)(totals.investmentPaise, row.investmentPaise ?? 0);
    totals.incomePaise = (0, _utils.addPaise)(totals.incomePaise, row.incomePaise ?? 0);
    totals.expensePaise = (0, _utils.addPaise)(totals.expensePaise, row.expensePaise ?? 0);
    totals.labourPaise = (0, _utils.addPaise)(totals.labourPaise, row.labourPaise ?? 0);
    totals.totalExpensesPaise = (0, _utils.addPaise)(totals.totalExpensesPaise, row.totalExpensesPaise ?? 0);
    totals.grossProfitLossPaise = (0, _utils.addPaise)(totals.grossProfitLossPaise, row.profitLossPaise ?? 0);
    if ((row.profitLossPaise ?? 0) >= 0) {
      totals.grossProfitPaise = (0, _utils.addPaise)(totals.grossProfitPaise, row.profitLossPaise ?? 0);
    } else {
      totals.grossLossPaise = (0, _utils.addPaise)(totals.grossLossPaise, -(row.profitLossPaise ?? 0));
    }
    totals.netPositionPaise = (0, _utils.addPaise)(totals.netPositionPaise, row.netPositionPaise ?? 0);
  }
  return totals;
}
