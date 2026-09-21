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
var _argon2 = require("argon2");
var _nodeCrypto = require("node:crypto");
var _duplicatePolicy = require("./duplicatePolicy");
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
    // await _audit.AuditService.log({
    //   actor: params.createdBy,
    //   action: "WORKER_PROFILE_CREATED",
    //   targetType: "WorkerProfile",
    //   targetId: profile._id.toString(),
    //   after: {
    //     workType: workType.name,
    //     employeeId
    //   }
    // });
    try {
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
    } catch (err) {
      console.error("Worker audit logging failed:", err);
    }
    return profile;
  },
  /**
   * Duplicate lookup used by BOTH the pre-flight check endpoint and
   * registerByAdmin. Matches an existing account by phone first, then by
   * email, and gathers everything needed to decide what to do: the worker
   * profile (if any) and how many of the account's documents are VERIFIED.
   */
  async findExistingWorkerAccount(input) {
    let user = await _User.User.findOne({
      phone: input.phone
    }).populate("role", "key label");
    let matchedPhone = Boolean(user);
    let matchedEmail = false;
    if (!user && input.email) {
      user = await _User.User.findOne({
        email: input.email.toLowerCase()
      }).populate("role", "key label");
      matchedEmail = Boolean(user);
    }
    if (!user) return null;
    const profile = await _WorkerProfile.WorkerProfile.findOne({
      user: user._id
    });
    const verifiedDocumentCount = await _Document.DocumentModel.countDocuments({
      owner: user._id,
      verificationStatus: "VERIFIED"
    });
    return {
      user,
      profile: profile ?? null,
      matchedPhone,
      matchedEmail,
      verifiedDocumentCount
    };
  },
  summarizeExistingAccount(existing) {
    return {
      userId: existing.user._id.toString(),
      workerId: existing.profile?._id?.toString() ?? null,
      employeeId: existing.profile?.employeeId ?? null,
      name: existing.user.name,
      phone: existing.user.phone,
      email: existing.user.email ?? null,
      role: existing.user.role?.key ?? null,
      userStatus: existing.user.status,
      verificationStatus: existing.profile?.verificationStatus ?? null,
      verifiedDocumentCount: existing.verifiedDocumentCount,
      documentsVerified: existing.verifiedDocumentCount > 0
    };
  },
  /**
   * Pre-flight duplicate check for the Admin "Add worker" panel: answers
   * "is this phone/email already registered, by whom, and can it still be
   * overwritten?" WITHOUT writing anything. `canOverwrite` is true only for
   * document-UNverified worker accounts — verified workers block reuse.
   */
  async checkDuplicate(input) {
    const existing = await this.findExistingWorkerAccount(input);
    if (!existing) {
      return {
        duplicate: false,
        matches: {
          phone: false,
          email: false
        },
        existing: null,
        verified: false,
        canOverwrite: false,
        message: ""
      };
    }
    const matches = {
      phone: existing.matchedPhone,
      email: existing.matchedEmail
    };
    const existingSummary = this.summarizeExistingAccount(existing);
    const matchedFields = [existing.matchedPhone && "phone number", existing.matchedEmail && "email"].filter(Boolean).join(" and ");
    const isWorkerAccount = existingSummary.role === "WORKER" || Boolean(existingSummary.workerId);
    if (!isWorkerAccount) {
      return {
        duplicate: true,
        matches,
        existing: existingSummary,
        verified: false,
        canOverwrite: false,
        message: `This ${matchedFields} already belongs to a ${existingSummary.role ?? "non-worker"} account and cannot be reused for worker registration.`
      };
    }
    const verified = (0, _duplicatePolicy.isWorkerDocumentVerified)(existingSummary);
    return {
      duplicate: true,
      matches,
      existing: existingSummary,
      verified,
      canOverwrite: !verified,
      message: verified ? `This ${matchedFields} already exists — it is registered to ${existingSummary.name} (Employee ID ${existingSummary.employeeId ?? "pending"}), whose documents are already verified. Please use a different ${matchedFields}.` : `Warning: this ${matchedFields} is already registered to ${existingSummary.name} (Employee ID ${existingSummary.employeeId ?? "pending"}). Their documents are NOT verified yet — you may still register, and the existing account will be updated with the new data.`
    };
  },
  /**
   * Admin confirmed the duplicate warning: UPDATE the existing account in
   * place with the newly entered data instead of creating a second account.
   * Only reachable for document-UNverified workers (the policy blocks
   * verified ones before this is ever called). The employee ID, ledger and
   * site-assignment history are preserved; the login data (name, phone,
   * email, password, work type, site) is replaced.
   */
  async updateExistingWorkerAccount(existing, input, actorId) {
    const user = existing.user;

    // Unique guards: never steal a unique field from a DIFFERENT account.
    if (input.email) {
      const emailOwner = await _User.User.findOne({
        email: input.email.toLowerCase()
      });
      if (emailOwner && emailOwner._id.toString() !== user._id.toString()) {
        throw new _AppError.AppError(_AppError.ERROR_CODES.CONFLICT, `Cannot update: the email ${input.email} already exists for a different account.`, 409, {
          kind: "EMAIL_TAKEN"
        });
      }
    }
    if (!existing.matchedPhone && input.phone) {
      const phoneOwner = await _User.User.findOne({
        phone: input.phone
      });
      if (phoneOwner && phoneOwner._id.toString() !== user._id.toString()) {
        throw new _AppError.AppError(_AppError.ERROR_CODES.CONFLICT, `Cannot update: the phone number ${input.phone} already exists for a different account.`, 409, {
          kind: "PHONE_TAKEN"
        });
      }
    }
    const before = {
      name: user.name,
      phone: user.phone,
      email: user.email ?? null,
      status: user.status,
      workType: existing.profile?.workType?.toString() ?? null
    };

    // 1. Update the login account in place (fresh credentials for handover).
    user.name = input.name;
    user.phone = input.phone;
    if (input.email) user.email = input.email.toLowerCase();
    user.status = "ACTIVE";
    user.phoneVerified = true;
    const temporaryPassword = input.password ?? _nodeCrypto.randomBytes(9).toString("base64url");
    user.passwordHash = await _argon2.hash(temporaryPassword);
    await user.save();

    // 2. Update (or create) the worker profile — employee id stays the same.
    let profile = existing.profile;
    if (profile) {
      const workType = await _WorkType.WorkType.findById(input.workTypeId);
      if (!workType || !workType.isActive) throw _AppError.AppError.validation("Invalid or inactive work type.");
      profile.workType = workType._id;
      await profile.save();
    } else {
      profile = await this.selectWorkType({
        userId: user._id.toString(),
        workTypeId: input.workTypeId,
        createdBy: actorId
      });
    }

    // 3. Optional site (re)assignment.
    if (input.siteId) {
      await this.assignSite({
        workerId: profile._id.toString(),
        siteId: input.siteId,
        assignedBy: actorId,
        reason: "Re-registration of existing (unverified) account"
      });
    }
    await _audit.AuditService.log({
      actor: actorId,
      action: "WORKER_DUPLICATE_ACCOUNT_UPDATED",
      targetType: "WorkerProfile",
      targetId: profile._id.toString(),
      before,
      after: {
        name: user.name,
        phone: user.phone,
        email: user.email ?? null,
        workType: profile.workType?.toString() ?? null
      }
    });
    try {
      (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.WORKER_UPDATED, {
        workerId: profile._id.toString(),
        employeeId: profile.employeeId,
        updatedExisting: true
      });
    } catch (err) {
      // Socket gateway may not be initialized in test/script contexts.
    }
    return {
      profile,
      temporaryPassword,
      updatedExisting: true
    };
  },
  /**
   * Super Admin / Manager "Add worker" from the Admin Web UI: creates the
   * User account (WORKER role — ACTIVE + phoneVerified, so the worker can
   * log in immediately with the handed-over credentials) and the
   * WorkerProfile in one step, optionally assigning the initial site.
   * Registration Steps 1–3 collapse into a single admin action; the worker
   * then continues through Steps 4–5 (documents -> verification) as usual.
   *
   * DUPLICATE HANDLING: if the phone/email already belongs to an existing
   * account —
   *   • document-VERIFIED worker  -> hard 409 error ("already exists"), never overwritten;
   *   • unverified worker, admin hasn't confirmed -> 409 with full duplicate
   *     details (kind: DUPLICATE_WORKER) so the Admin UI shows the warning;
   *   • unverified worker + confirmDuplicate=true -> the EXISTING account is
   *     updated in place with the new data (same employee ID, history kept).
   */
  async registerByAdmin(input, actorId) {
    const existing = await this.findExistingWorkerAccount(input);
    if (existing) {
      const existingSummary = this.summarizeExistingAccount(existing);
      const isWorkerAccount = existingSummary.role === "WORKER" || Boolean(existingSummary.workerId);
      if (!isWorkerAccount) {
        throw new _AppError.AppError(_AppError.ERROR_CODES.CONFLICT, `This ${existing.matchedPhone ? "phone number" : "email"} already belongs to a ${existingSummary.role ?? "non-worker"} account and cannot be used for worker registration.`, 409, {
          kind: "DUPLICATE_NON_WORKER",
          matches: {
            phone: existing.matchedPhone,
            email: existing.matchedEmail
          },
          existing: existingSummary
        });
      }
      const decision = (0, _duplicatePolicy.decideDuplicateRegistration)({
        matches: {
          phone: existing.matchedPhone,
          email: existing.matchedEmail
        },
        confirmDuplicate: input.confirmDuplicate === true,
        existing: existingSummary
      });
      if (decision.action === _duplicatePolicy.DUPLICATE_ACTIONS.BLOCK_VERIFIED) {
        throw new _AppError.AppError(_AppError.ERROR_CODES.CONFLICT, decision.message, 409, {
          kind: "DUPLICATE_WORKER_VERIFIED",
          matches: {
            phone: existing.matchedPhone,
            email: existing.matchedEmail
          },
          existing: existingSummary
        });
      }
      if (decision.action === _duplicatePolicy.DUPLICATE_ACTIONS.WARN_CONFIRM_REQUIRED) {
        throw new _AppError.AppError(_AppError.ERROR_CODES.CONFLICT, decision.message, 409, {
          kind: "DUPLICATE_WORKER",
          matches: {
            phone: existing.matchedPhone,
            email: existing.matchedEmail
          },
          existing: existingSummary
        });
      }
      if (decision.action === _duplicatePolicy.DUPLICATE_ACTIONS.UPDATE_EXISTING) {
        return this.updateExistingWorkerAccount(existing, input, actorId);
      }
    }
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
      temporaryPassword,
      updatedExisting: false
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