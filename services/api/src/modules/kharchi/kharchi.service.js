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
exports.KharchiService = {
  async create(input) {
    const profile = await _WorkerProfile.WorkerProfile.findById(input.workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    const request = await _Requests.KharchiRequest.create({
      worker: profile._id,
      site: input.siteId,
      amountPaise: (0, _utils.rupeesToPaise)(input.amountRupees),
      date: new Date(input.date),
      category: input.category,
      reason: input.reason,
      submittedBy: input.submittedBy,
      status: "REQUESTED"
    });
    await _audit.AuditService.log({
      actor: input.submittedBy,
      action: "KHARCHI_REQUESTED",
      targetType: "KharchiRequest",
      targetId: request._id.toString(),
      after: {
        amountRupees: input.amountRupees,
        category: input.category
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.KHARCHI_CREATED, {
      requestId: request._id.toString(),
      workerId: profile._id.toString()
    });
    return request;
  },
  /**
   * Approving a Kharchi request immediately posts the deduction (spec §14
   * treats Kharchi as a same-step approve+payout, unlike the two-step
   * Advance flow which has a separate PAID transition).
   */
  async approve(requestId, approvedBy) {
    const request = await _Requests.KharchiRequest.findById(requestId);
    if (!request) throw _AppError.AppError.notFound("Kharchi request not found");
    if (request.status !== "REQUESTED") {
      throw _AppError.AppError.conflict(`Cannot approve a request in status ${request.status}.`);
    }
    request.status = "APPROVED";
    request.approvedBy = approvedBy;
    await request.save();
    await _salary.SalaryService.postDeduction({
      workerId: request.worker.toString(),
      siteId: request.site.toString(),
      type: "KHARCHI_DEDUCTION",
      amountPaise: request.amountPaise,
      description: `Kharchi — ${request.category} — ${request.reason}`,
      reference: request._id.toString(),
      actorId: approvedBy
    });
    await _audit.AuditService.log({
      actor: approvedBy,
      action: "KHARCHI_APPROVED",
      targetType: "KharchiRequest",
      targetId: request._id.toString()
    });
    const profile = await _WorkerProfile.WorkerProfile.findById(request.worker);
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "KHARCHI_APPROVED",
      title: "Your Kharchi request was approved.",
      body: `Category: ${request.category}`
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(request.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.KHARCHI_APPROVED, {
      requestId: request._id.toString()
    });
    return request;
  },
  async reject(requestId, rejectionReason, rejectedBy) {
    const request = await _Requests.KharchiRequest.findById(requestId);
    if (!request) throw _AppError.AppError.notFound("Kharchi request not found");
    if (request.status !== "REQUESTED") {
      throw _AppError.AppError.conflict(`Cannot reject a request in status ${request.status}.`);
    }
    request.status = "REJECTED";
    request.rejectionReason = rejectionReason;
    request.approvedBy = rejectedBy;
    await request.save();
    await _audit.AuditService.log({
      actor: rejectedBy,
      action: "KHARCHI_REJECTED",
      targetType: "KharchiRequest",
      targetId: request._id.toString(),
      after: {
        rejectionReason
      }
    });
    const profile = await _WorkerProfile.WorkerProfile.findById(request.worker);
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "KHARCHI_REJECTED",
      title: "Your Kharchi request was rejected.",
      body: rejectionReason
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(request.worker.toString())).emit(_sharedTypes.SOCKET_EVENTS.KHARCHI_REJECTED, {
      requestId: request._id.toString()
    });
    return request;
  },
  async list(filter) {
    const query = {};
    if (filter.worker) query.worker = filter.worker;
    if (filter.site) query.site = filter.site;
    if (filter.status) query.status = filter.status;
    return _Requests.KharchiRequest.find(query).populate("worker", "employeeId").populate("site", "name code").sort({
      createdAt: -1
    });
  }
};