Object.defineProperty(exports, "__esModule", {
  value: true
});
var _Attendance = require("../../db/models/Attendance");
var _MonthlyPayroll = require("../../db/models/MonthlyPayroll");
var _finance = require("../finance/finance.service");
var _utils = require("@ananta/utils");
function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(","));
  }
  return lines.join("\n");
}
exports.ReportService = {
  async attendanceReport(filter) {
    const query = {};
    if (filter.site) query.site = filter.site;
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) query.date.$gte = new Date(filter.from);
      if (filter.to) query.date.$lte = new Date(filter.to);
    }
    const records = await _Attendance.Attendance.find(query).populate("worker", "employeeId").populate("site", "name code").sort({
      date: -1
    });
    return records.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      employeeId: r.worker?.employeeId,
      site: r.site?.name,
      status: r.status,
      hoursWorked: r.hoursWorked,
      overtimeHours: r.overtimeHours
    }));
  },
  async payrollReport(month) {
    const payrolls = await _MonthlyPayroll.MonthlyPayroll.find({
      month
    }).populate("worker", "employeeId");
    return payrolls.map(p => ({
      employeeId: p.worker?.employeeId,
      month: p.month,
      grossEarnings: (0, _utils.paiseToRupees)(p.grossEarningsPaise),
      overtimeEarnings: (0, _utils.paiseToRupees)(p.overtimeEarningsPaise),
      advanceDeductions: (0, _utils.paiseToRupees)(p.advanceDeductionsPaise),
      kharchiDeductions: (0, _utils.paiseToRupees)(p.kharchiDeductionsPaise),
      netSalary: (0, _utils.paiseToRupees)(p.netSalaryPaise),
      status: p.status
    }));
  },
  async siteFinanceReport(siteId) {
    const profitLoss = await _finance.FinanceService.getSiteProfitLoss(siteId);
    return [profitLoss];
  },
  toCsv
};