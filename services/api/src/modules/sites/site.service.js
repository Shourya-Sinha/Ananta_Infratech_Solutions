Object.defineProperty(exports, "__esModule", {
  value: true
});
var _Site = require("../../db/models/Site");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _utils = require("@ananta/utils");
exports.SiteService = {
  async list(filter) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.manager) query.manager = filter.manager;
    return _Site.Site.find(query).populate("manager", "name phone").sort({
      createdAt: -1
    });
  },
  /** Sites visible to a manager: only ones they're assigned as manager on. */
  async listForManager(managerId) {
    return _Site.Site.find({
      manager: managerId
    }).sort({
      createdAt: -1
    });
  },
  async getById(siteId) {
    const site = await _Site.Site.findById(siteId).populate("manager", "name phone");
    if (!site) throw _AppError.AppError.notFound("Site not found");
    return site;
  },
  async create(input, actorId) {
    const existing = await _Site.Site.findOne({
      code: input.code.toUpperCase()
    });
    if (existing) throw _AppError.AppError.conflict("A site with this code already exists.");
    const site = await _Site.Site.create({
      name: input.name,
      code: input.code.toUpperCase(),
      address: input.address,
      client: input.client,
      projectType: input.projectType,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      expectedCompletionDate: input.expectedCompletionDate ? new Date(input.expectedCompletionDate) : undefined,
      manager: input.manager,
      budgetPaise: input.budgetRupees !== undefined ? (0, _utils.rupeesToPaise)(input.budgetRupees) : undefined,
      description: input.description,
      status: "PLANNING"
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "SITE_CREATED",
      targetType: "Site",
      targetId: site._id.toString(),
      after: {
        name: input.name,
        code: input.code
      }
    });
    return site;
  },
  async update(siteId, updates, actorId) {
    const site = await _Site.Site.findById(siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const before = {
      status: site.status,
      manager: site.manager?.toString()
    };
    if (updates.name !== undefined) site.name = updates.name;
    if (updates.address !== undefined) site.address = updates.address;
    if (updates.client !== undefined) site.client = updates.client;
    if (updates.projectType !== undefined) site.projectType = updates.projectType;
    if (updates.manager !== undefined) site.manager = updates.manager;
    if (updates.status !== undefined) site.status = updates.status;
    if (updates.description !== undefined) site.description = updates.description;
    if (updates.budgetRupees !== undefined) site.budgetPaise = (0, _utils.rupeesToPaise)(updates.budgetRupees);
    if (updates.startDate !== undefined) site.startDate = new Date(updates.startDate);
    if (updates.expectedCompletionDate !== undefined) {
      site.expectedCompletionDate = new Date(updates.expectedCompletionDate);
    }
    await site.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "SITE_UPDATED",
      targetType: "Site",
      targetId: site._id.toString(),
      before,
      after: updates
    });
    return site;
  },
  async delete(siteId, actorId) {
    const site = await _Site.Site.findById(siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    site.status = "CANCELLED";
    await site.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "SITE_DELETED",
      targetType: "Site",
      targetId: site._id.toString()
    });
    return {
      cancelled: true
    };
  }
};