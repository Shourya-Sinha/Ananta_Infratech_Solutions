Object.defineProperty(exports, "__esModule", {
  value: true
});
var _Requests = require("../../db/models/Requests");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _salary = require("../salary/salary.service");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _notification = require("../notifications/notification.service");
var _gateway = require("../../sockets/gateway");
var _sharedTypes = require("@ananta/shared-types");
var _utils = require("@ananta/utils");
exports.AdvanceService = {
  async create(input) {
    const profile = await _WorkerProfile.WorkerProfile.findById(input.workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    const request = await _Requests.AdvanceRequest.create({
      worker: profile._id,
      amountPaise: (0, _utils.rupeesToPaise)(input.amountRupees),
      reason: input.reason,
      requestedDate: new Date(input.requestedDate),
      submittedBy: input.submittedBy,
      status: "REQUESTED"
    });
    await _audit.AuditService.log({
      actor: input.submittedBy,
      action: "ADVANCE_REQUESTED",
      targetType: "AdvanceRequest",
      targetId: request._id.toString(),
      after: {
        amountRupees: input.amountRupees
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.ADVANCE_CREATED, {
      requestId: request._id.toString(),
      workerId: profile._id.toString()
    });
    return request;
  },
  async approve(requestId, approvedAmountRupees, approvedBy) {
    const request = await _Requests.AdvanceRequest.findById(requestId);
    if (!request) throw _AppError.AppError.notFound("Advance request not found");
    if (request.status !== "REQUESTED") {
      throw _AppError.AppError.conflict(`Cannot approve a request in status ${request.status}.`);
    }
    const approvedAmountPaise = (0, _utils.rupeesToPaise)(approvedAmountRupees);
    const originalAmountPaise = request.amountPaise;
    request.status = approvedAmountPaise < originalAmountPaise ? "PARTIALLY_APPROVED" : "APPROVED";
    request.approvedAmountPaise = approvedAmountPaise;
    request.approvedBy = approvedBy;
    await request.save();
    await _audit.AuditService.log({
      actor: approvedBy,
      action: "ADVANCE_APPROVED",
      targetType: "AdvanceRequest",
      targetId: request._id.toString(),
      after: {
        approvedAmountRupees,
        status: request.status
      }
    });
    const profile = await _WorkerProfile.WorkerProfile.findById(request.worker);
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "ADVANCE_APPROVED",
      title: "Your advance request was approved.",
      body: `Approved amount: ₹${approvedAmountRupees}.`
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(request.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.ADVANCE_APPROVED, {
      requestId: request._id.toString()
    });
    return request;
  },
  async reject(requestId, rejectionReason, rejectedBy) {
    const request = await _Requests.AdvanceRequest.findById(requestId);
    if (!request) throw _AppError.AppError.notFound("Advance request not found");
    if (request.status !== "REQUESTED") {
      throw _AppError.AppError.conflict(`Cannot reject a request in status ${request.status}.`);
    }
    request.status = "REJECTED";
    request.rejectionReason = rejectionReason;
    request.approvedBy = rejectedBy;
    await request.save();
    await _audit.AuditService.log({
      actor: rejectedBy,
      action: "ADVANCE_REJECTED",
      targetType: "AdvanceRequest",
      targetId: request._id.toString(),
      after: {
        rejectionReason
      }
    });
    const profile = await _WorkerProfile.WorkerProfile.findById(request.worker);
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "ADVANCE_REJECTED",
      title: "Your advance request was rejected.",
      body: rejectionReason
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(request.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.ADVANCE_REJECTED, {
      requestId: request._id.toString()
    });
    return request;
  },
  /**
   * Marking PAID is the only point at which a deduction hits the salary
   * ledger (§13 of spec: "If approved and paid: amount is automatically
   * included as a salary deduction").
   */
  async markPaid(requestId, siteId, paidBy) {
    const request = await _Requests.AdvanceRequest.findById(requestId);
    if (!request) throw _AppError.AppError.notFound("Advance request not found");
    if (request.status !== "APPROVED" && request.status !== "PARTIALLY_APPROVED") {
      throw _AppError.AppError.conflict(`Cannot mark paid a request in status ${request.status}.`);
    }
    request.status = "PAID";
    await request.save();
    await _salary.SalaryService.postDeduction({
      workerId: request.worker.toString(),
      siteId,
      type: "ADVANCE_DEDUCTION",
      amountPaise: request.approvedAmountPaise ?? request.amountPaise,
      description: `Advance payout — ${request.reason}`,
      reference: request._id.toString(),
      actorId: paidBy
    });
    await _audit.AuditService.log({
      actor: paidBy,
      action: "ADVANCE_PAID",
      targetType: "AdvanceRequest",
      targetId: request._id.toString()
    });
    const profile = await _WorkerProfile.WorkerProfile.findById(request.worker);
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "ADVANCE_PAID",
      title: "Your advance has been paid.",
      body: "The amount has been credited and will be deducted from your salary."
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(request.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.ADVANCE_PAID, {
      requestId: request._id.toString()
    });
    return request;
  },
  async cancel(requestId, actorId) {
    const request = await _Requests.AdvanceRequest.findById(requestId);
    if (!request) throw _AppError.AppError.notFound("Advance request not found");
    if (request.status !== "REQUESTED") {
      throw _AppError.AppError.conflict("Only a REQUESTED advance can be cancelled.");
    }
    request.status = "CANCELLED";
    await request.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "ADVANCE_CANCELLED",
      targetType: "AdvanceRequest",
      targetId: request._id.toString()
    });
    return request;
  },
  async list(filter) {
    const query = {};
    if (filter.worker) query.worker = filter.worker;
    if (filter.status) query.status = filter.status;
    return _Requests.AdvanceRequest.find(query).populate("worker", "employeeId").sort({
      createdAt: -1
    });
  }
};