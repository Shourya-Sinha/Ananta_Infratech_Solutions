Object.defineProperty(exports, "__esModule", {
  value: true
});
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _WorkType = require("../../db/models/WorkType");
var _Site = require("../../db/models/Site");
var _SiteAssignment = require("../../db/models/SiteAssignment");
var _Document = require("../../db/models/Document");
var _User = require("../../db/models/User");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _employeeId = require("./employeeId.util");
var _gateway = require("../../sockets/gateway");
var _sharedTypes = require("@ananta/shared-types");
var _notification = require("../notifications/notification.service");
exports.WorkerService = {
  /**
   * Registration Step 2: select work type. Creates the WorkerProfile shell.
   * Called after Step 1 (User creation) + Step 3 (OTP verify) have already
   * happened in the auth module.
   */
  async selectWorkType(params) {
    const user = await _User.User.findById(params.userId);
    if (!user) throw _AppError.AppError.notFound("User not found");
    const existingProfile = await _WorkerProfile.WorkerProfile.findOne({
      user: user._id
    });
    if (existingProfile) throw _AppError.AppError.conflict("Worker profile already exists for this user.");
    const workType = await _WorkType.WorkType.findById(params.workTypeId);
    if (!workType || !workType.isActive) throw _AppError.AppError.validation("Invalid or inactive work type.");
    const employeeId = await (0, _employeeId.generateEmployeeId)();
    const profile = await _WorkerProfile.WorkerProfile.create({
      user: user._id,
      employeeId,
      workType: workType._id,
      verificationStatus: "PENDING_VERIFICATION",
      createdBy: params.createdBy
    });
    await _audit.AuditService.log({
      actor: params.createdBy,
      action: "WORKER_PROFILE_CREATED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString(),
      after: {
        workType: workType.name,
        employeeId
      }
    });
    return profile;
  },
  /**
   * Super Admin / Manager "Add worker" from the Admin Web UI: creates the
   * User account (WORKER role — ACTIVE + phoneVerified, so the worker can
   * log in immediately with the handed-over credentials) and the
   * WorkerProfile in one step, optionally assigning the initial site.
   * Registration Steps 1–3 collapse into a single admin action; the worker
   * then continues through Steps 4–5 (documents -> verification) as usual.
   */
  async registerByAdmin(input, actorId) {
    // Lazy require keeps module-init order independent of the users module.
    const {
      UserService
    } = require("../users/user.service");
    const {
      user,
      temporaryPassword
    } = await UserService.create({
      name: input.name,
      phone: input.phone,
      email: input.email,
      roleKey: "WORKER",
      password: input.password
    }, actorId);
    const profile = await this.selectWorkType({
      userId: user._id.toString(),
      workTypeId: input.workTypeId,
      createdBy: actorId
    });
    if (input.siteId) {
      await this.assignSite({
        workerId: profile._id.toString(),
        siteId: input.siteId,
        assignedBy: actorId,
        reason: "Initial assignment at registration"
      });
    }
    try {
      (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.WORKER_CREATED, {
        workerId: profile._id.toString(),
        employeeId: profile.employeeId
      });
    } catch (err) {
      // Socket gateway may not be initialized in test/script contexts —
      // registration itself has already succeeded at this point.
    }
    return {
      profile,
      temporaryPassword
    };
  },
  /**
   * Registration Step 5 (admin side): review uploaded documents and mark
   * DOCUMENT_VERIFIED once all required docs pass. Progression:
   * PENDING_VERIFICATION -> DOCUMENT_VERIFIED -> WORK_TYPE_VERIFIED -> ACTIVE
   */
  async verifyDocuments(workerId, verifiedBy) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    const docs = await _Document.DocumentModel.find({
      owner: profile.user
    });
    if (docs.length === 0) throw _AppError.AppError.validation("No documents uploaded yet.");
    const allVerified = docs.every(d => d.verificationStatus === "VERIFIED");
    if (!allVerified) {
      throw _AppError.AppError.validation("All uploaded documents must be individually verified first.");
    }
    profile.verificationStatus = "DOCUMENT_VERIFIED";
    await profile.save();
    await _audit.AuditService.log({
      actor: verifiedBy,
      action: "WORKER_DOCUMENTS_VERIFIED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString()
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.WORKER_VERIFICATION_UPDATED, {
      workerId: profile._id.toString(),
      status: profile.verificationStatus
    });
    return profile;
  },
  async verifyWorkType(workerId, verifiedBy) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    if (profile.verificationStatus !== "DOCUMENT_VERIFIED") {
      throw _AppError.AppError.validation("Documents must be verified before work type verification.");
    }
    profile.verificationStatus = "WORK_TYPE_VERIFIED";
    await profile.save();
    await _audit.AuditService.log({
      actor: verifiedBy,
      action: "WORKER_WORK_TYPE_VERIFIED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString()
    });
    return profile;
  },
  /** Final activation step — worker account becomes ACTIVE and usable. */
  async activate(workerId, activatedBy) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    if (profile.verificationStatus !== "WORK_TYPE_VERIFIED") {
      throw _AppError.AppError.validation("Worker must pass document and work-type verification first.");
    }
    profile.verificationStatus = "ACTIVE";
    await profile.save();
    await _User.User.findByIdAndUpdate(profile.user, {
      status: "ACTIVE"
    });
    await _audit.AuditService.log({
      actor: activatedBy,
      action: "WORKER_ACTIVATED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString()
    });
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "ACCOUNT_VERIFIED",
      title: "Account verified",
      body: "Your account has been verified. Welcome to Ananta Infratech!"
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.WORKER_VERIFICATION_UPDATED, {
      workerId: profile._id.toString(),
      status: "ACTIVE"
    });
    return profile;
  },
  async reject(workerId, reason, rejectedBy) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    profile.verificationStatus = "REJECTED";
    profile.verificationNotes = reason;
    await profile.save();
    await _audit.AuditService.log({
      actor: rejectedBy,
      action: "WORKER_REJECTED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString(),
      after: {
        reason
      }
    });
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "DOCUMENT_CORRECTION_NEEDED",
      title: "Your document requires correction",
      body: reason
    });
    return profile;
  },
  /**
   * Site assignment. Never overwrites history (§9 of spec): closes any
   * currently ACTIVE assignment and opens a new one.
   */
  async assignSite(params) {
    const [profile, site] = await Promise.all([_WorkerProfile.WorkerProfile.findById(params.workerId), _Site.Site.findById(params.siteId)]);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const now = new Date();
    const currentAssignment = await _SiteAssignment.SiteAssignment.findOne({
      worker: profile._id,
      status: "ACTIVE"
    });
    if (currentAssignment) {
      currentAssignment.status = "ENDED";
      currentAssignment.endDate = now;
      await currentAssignment.save();
    }
    const newAssignment = await _SiteAssignment.SiteAssignment.create({
      worker: profile._id,
      site: site._id,
      startDate: now,
      assignedBy: params.assignedBy,
      reason: params.reason,
      status: "ACTIVE"
    });
    profile.currentSite = site._id;
    await profile.save();
    await _audit.AuditService.log({
      actor: params.assignedBy,
      action: "WORKER_SITE_ASSIGNED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString(),
      before: {
        site: currentAssignment?.site?.toString()
      },
      after: {
        site: site._id.toString()
      }
    });
    await _notification.NotificationService.send({
      recipient: profile.user.toString(),
      type: "SITE_ASSIGNED",
      title: "You have been assigned to a new site",
      body: `You are now assigned to ${site.name}.`
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.WORKER_SITE_ASSIGNED, {
      workerId: profile._id.toString(),
      siteId: site._id.toString()
    });
    return newAssignment;
  },
  async changeWorkType(workerId, workTypeId, changedBy) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId);
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    const workType = await _WorkType.WorkType.findById(workTypeId);
    if (!workType || !workType.isActive) throw _AppError.AppError.validation("Invalid or inactive work type.");
    const before = {
      workType: profile.workType?.toString()
    };
    profile.workType = workType._id;
    await profile.save();
    await _audit.AuditService.log({
      actor: changedBy,
      action: "WORKER_WORK_TYPE_CHANGED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString(),
      before,
      after: {
        workType: workType.name
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.worker(profile._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.WORKER_WORK_TYPE_UPDATED, {
      workerId: profile._id.toString()
    });
    return profile;
  },
  async getById(workerId) {
    const profile = await _WorkerProfile.WorkerProfile.findById(workerId).populate("user", "name phone email status").populate("workType", "name code defaultDailyRatePaise").populate("currentSite", "name code status");
    if (!profile) throw _AppError.AppError.notFound("Worker not found");
    return profile;
  },
  async getByUserId(userId) {
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: userId
    }).populate("user", "name phone email status").populate("workType", "name code defaultDailyRatePaise").populate("currentSite", "name code status");
    if (!profile) throw _AppError.AppError.notFound("Worker profile not found for this account");
    return profile;
  },
  async list(filter) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const query = {};
    if (filter.site) query.currentSite = filter.site;
    if (filter.workType) query.workType = filter.workType;
    if (filter.verificationStatus) query.verificationStatus = filter.verificationStatus;
    const [items, total] = await Promise.all([_WorkerProfile.WorkerProfile.find(query).populate("user", "name phone").populate("workType", "name").populate("currentSite", "name code").sort({
      createdAt: -1
    }).skip((page - 1) * pageSize).limit(pageSize), _WorkerProfile.WorkerProfile.countDocuments(query)]);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  },
  /** Workers visible to a manager: those currently on a site the manager manages. */
  async listForManager(managerId) {
    const managedSites = await _Site.Site.find({
      manager: managerId
    }).select("_id");
    const siteIds = managedSites.map(s => s._id);
    return _WorkerProfile.WorkerProfile.find({
      currentSite: {
        $in: siteIds
      }
    }).populate("user", "name phone").populate("workType", "name defaultDailyRatePaise").sort({
      createdAt: -1
    });
  },
  async getAssignmentHistory(workerId) {
    return _SiteAssignment.SiteAssignment.find({
      worker: workerId
    }).populate("site", "name code").sort({
      startDate: -1
    });
  }
};