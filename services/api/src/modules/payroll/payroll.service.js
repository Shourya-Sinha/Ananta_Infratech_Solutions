Object.defineProperty(exports, "__esModule", {
  value: true
});
var _MonthlyPayroll = require("../../db/models/MonthlyPayroll");
var _SalaryLedger = require("../../db/models/SalaryLedger");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _notification = require("../notifications/notification.service");
var _salary = require("../salary/salary.service");
var _financeEvents = require("../../sockets/financeEvents");
var _sharedTypes = require("@ananta/shared-types");
var _utils = require("@ananta/utils");
var _Attendance = require("../../db/models/Attendance");
function monthBounds(month) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59))
  };
}
exports.PayrollService = {
  /** Recalculates every active worker's payroll for the month (DRAFT/CALCULATED). */
  async calculateMonth(month, actorId) {
    const workers = await _WorkerProfile.WorkerProfile.find({
      verificationStatus: "ACTIVE"
    });
    const results = [];
    for (const worker of workers) {
      try {
        const payroll = await _salary.SalaryService.recalculateMonth(worker._id.toString(), month);
        results.push({
          worker: worker._id.toString(),
          status: payroll.status,
          netSalaryPaise: payroll.netSalaryPaise
        });
      } catch (err) {
        results.push({
          worker: worker._id.toString(),
          status: "ERROR",
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }
    await _audit.AuditService.log({
      actor: actorId,
      action: "PAYROLL_MONTH_CALCULATED",
      targetType: "MonthlyPayroll",
      targetId: month,
      after: {
        workerCount: results.length
      }
    });
    return results;
  },
  async getMonth(month) {
    // Populate enough of each worker to show name + site + daily rate on the
    // payroll sheet, so admin can filter "each worker payment of a site".
    return _MonthlyPayroll.MonthlyPayroll.find({
      month
    }).populate({
      path: "worker",
      select: "employeeId user currentSite workType",
      populate: [{
        path: "user",
        select: "name"
      }, {
        path: "currentSite",
        select: "name code"
      }, {
        path: "workType",
        select: "name defaultDailyRatePaise"
      }]
    });
  },
  async getWorkerMonth(workerId, month) {
    const payroll = await _MonthlyPayroll.MonthlyPayroll.findOne({
      worker: workerId,
      month
    });
    if (!payroll) throw _AppError.AppError.notFound(`No payroll record for ${month}`);
    return payroll;
  },
  /**
   * Moves every CALCULATED payroll for the month to FINALIZED. After this,
   * Attendance records for the month are locked (§43 of spec) — further
   * changes require a correction + adjustment ledger entry, not a silent edit.
   */
  async finalizeMonth(month, actorId) {
    const payrolls = await _MonthlyPayroll.MonthlyPayroll.find({
      month,
      status: {
        $in: ["CALCULATED", "REVIEW"]
      }
    });
    if (payrolls.length === 0) {
      throw _AppError.AppError.validation(`No CALCULATED/REVIEW payroll records found for ${month} to finalize.`);
    }
    const {
      from,
      to
    } = monthBounds(month);
    const now = new Date();
    for (const payroll of payrolls) {
      payroll.status = "FINALIZED";
      payroll.finalizedBy = actorId;
      payroll.finalizedAt = now;
      await payroll.save();
      await _Attendance.Attendance.updateMany({
        worker: payroll.worker,
        date: {
          $gte: from,
          $lte: to
        }
      }, {
        locked: true
      });
      (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(payroll.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.SALARY_MONTH_FINALIZED, {
        workerId: payroll.worker.toString(),
        month
      });
      (0, _financeEvents.emitFinanceUpdate)({ reason: "SALARY_MONTH_FINALIZED", workerId: payroll.worker });
    }
    await _audit.AuditService.log({
      actor: actorId,
      action: "PAYROLL_MONTH_FINALIZED",
      targetType: "MonthlyPayroll",
      targetId: month,
      after: {
        workerCount: payrolls.length
      }
    });
    return {
      finalizedCount: payrolls.length
    };
  },
  async markPaid(month, actorId) {
    const payrolls = await _MonthlyPayroll.MonthlyPayroll.find({
      month,
      status: "FINALIZED"
    });
    if (payrolls.length === 0) {
      throw _AppError.AppError.validation(`No FINALIZED payroll records found for ${month} to mark paid.`);
    }
    const now = new Date();
    for (const payroll of payrolls) {
      payroll.status = "PAID";
      payroll.paidAt = now;
      await payroll.save();
      await _notification.NotificationService.send({
        recipient: (await _WorkerProfile.WorkerProfile.findById(payroll.worker)).user.toString(),
        type: "SALARY_PAID",
        title: "Your salary has been paid",
        body: `Your salary for ${month} has been processed.`
      });
    }
    await _audit.AuditService.log({
      actor: actorId,
      action: "PAYROLL_MONTH_PAID",
      targetType: "MonthlyPayroll",
      targetId: month,
      after: {
        workerCount: payrolls.length
      }
    });
    return {
      paidCount: payrolls.length
    };
  },
  /**
   * Marks ONE worker's month paid and (optionally) stores the payment
   * receipt with its OCR extraction. Used when salary is sent worker-by-
   * worker via UPI/bank instead of the whole-month bulk mark-paid.
   */
  async markWorkerPaid({ workerId, month, receipt }, actorId) {
    const { SalaryPaymentReceipt } = require("../../db/models/SalaryPaymentReceipt");
    const payroll = await _MonthlyPayroll.MonthlyPayroll.findOne({ worker: workerId, month });
    if (!payroll) throw _AppError.AppError.notFound(`No payroll record for ${month}. Calculate the month first.`);
    if (payroll.status !== "FINALIZED" && payroll.status !== "PAID") {
      throw _AppError.AppError.conflict(`Payroll for ${month} must be FINALIZED before it can be marked paid (current: ${payroll.status}).`);
    }
    let savedReceipt = null;
    if (receipt) {
      savedReceipt = await SalaryPaymentReceipt.create({
        worker: workerId,
        payroll: payroll._id,
        month,
        amountPaise: receipt.amountPaise ?? payroll.netSalaryPaise,
        method: receipt.method ?? "UPI",
        transactionId: receipt.transactionId,
        paidAt: receipt.paidAt ?? new Date(),
        document: receipt.documentId,
        receiptUrl: receipt.receiptUrl,
        ocr: receipt.ocr,
        note: receipt.note,
        uploadedBy: actorId
      });
    }
    if (payroll.status !== "PAID") {
      payroll.status = "PAID";
      payroll.paidAt = receipt?.paidAt ?? new Date();
      await payroll.save();
      const profile = await _WorkerProfile.WorkerProfile.findById(workerId);
      if (profile) {
        await _notification.NotificationService.send({
          recipient: profile.user.toString(),
          type: "SALARY_PAID",
          title: "Your salary has been paid",
          body: `Your salary for ${month} has been sent.${savedReceipt ? " Tap Salary to view the payment receipt." : ""}`
        });
      }
    }
    await _audit.AuditService.log({
      actor: actorId,
      action: "PAYROLL_WORKER_PAID",
      targetType: "MonthlyPayroll",
      targetId: payroll._id.toString(),
      after: { month, receiptId: savedReceipt?._id?.toString(), transactionId: savedReceipt?.transactionId }
    });
    (0, _financeEvents.emitFinanceUpdate)({ reason: "PAYROLL_WORKER_PAID", workerId, month });
    return { payroll, receipt: savedReceipt };
  },
  async listWorkerReceipts(workerId) {
    const { SalaryPaymentReceipt } = require("../../db/models/SalaryPaymentReceipt");
    return SalaryPaymentReceipt.find({ worker: workerId }).sort({ createdAt: -1 });
  },
  /**
   * Posts an ADJUSTMENT ledger entry against a FINALIZED/PAID month instead
   * of mutating history (§43 of spec: "Do not silently change finalized payroll").
   * Does NOT reopen the payroll status — a fresh calculateMonth pass for a
   * later cycle would need to account for this via the next month's rollup,
   * or an explicit re-finalization decision made by an admin outside this call.
   */
  async postAdjustment(params) {
    const isCredit = params.amountPaise >= 0;
    const magnitude = Math.abs(params.amountPaise);
    const last = await _SalaryLedger.SalaryLedger.findOne({
      worker: params.workerId
    }).sort({
      createdAt: -1
    });
    const lastBalance = last ? Number(last.runningBalancePaise.toString()) : 0;
    const newBalance = isCredit ? (0, _utils.addPaise)(lastBalance, magnitude) : lastBalance - magnitude;
    const entry = await _SalaryLedger.SalaryLedger.create({
      worker: params.workerId,
      site: params.siteId,
      date: new Date(),
      type: "ADJUSTMENT",
      description: params.description,
      creditPaise: isCredit ? magnitude.toString() : "0",
      debitPaise: isCredit ? "0" : magnitude.toString(),
      runningBalancePaise: newBalance.toString(),
      createdBy: params.actorId
    });
    await _audit.AuditService.log({
      actor: params.actorId,
      action: "SALARY_ADJUSTMENT_POSTED",
      targetType: "SalaryLedger",
      targetId: entry._id.toString(),
      after: {
        amountPaise: params.amountPaise,
        description: params.description
      }
    });
    return entry;
  }
};