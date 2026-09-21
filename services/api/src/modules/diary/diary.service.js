"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiaryService = void 0;
const _Finance = require("../../db/models/Finance");
const _Site = require("../../db/models/Site");
const _AppError = require("../../errors/AppError");
const _audit = require("../auditLogs/audit.service");
const _gateway = require("../../sockets/gateway");
const _sharedTypes = require("@ananta/shared-types");
const mongoose = require("mongoose");

exports.DiaryService = {
  async create(input, actorId) {
    const site = await _Site.Site.findById(input.siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const existing = await _Finance.SiteDiary.findOne({
      site: site._id,
      date: new Date(input.date)
    });
    if (existing) {
      // Update existing entry for same date+site instead of duplicating
      return this.update(existing._id.toString(), input, actorId);
    }
    const entry = await _Finance.SiteDiary.create({
      site: site._id,
      date: new Date(input.date),
      weather: input.weather ?? "SUNNY",
      workDone: input.workDone,
      workersPresent: input.workersPresent ?? 0,
      materialsReceived: input.materialsReceived,
      issues: input.issues,
      nextDayPlan: input.nextDayPlan,
      photos: input.photos ?? [],
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "DIARY_CREATED",
      targetType: "SiteDiary",
      targetId: entry._id.toString(),
      after: { siteId: site._id.toString(), date: input.date }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.DIARY_CREATED, {
      diaryId: entry._id.toString(),
      siteId: site._id.toString(),
      date: entry.date
    });
    return entry.populate("site", "name code").populate("createdBy", "name");
  },

  async update(id, input, actorId) {
    const entry = await _Finance.SiteDiary.findById(id);
    if (!entry) throw _AppError.AppError.notFound("Diary entry not found");
    const fields = ["weather", "workDone", "workersPresent", "materialsReceived", "issues", "nextDayPlan", "photos"];
    for (const f of fields) {
      if (input[f] !== undefined) entry[f] = input[f];
    }
    entry.updatedBy = actorId;
    await entry.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "DIARY_UPDATED",
      targetType: "SiteDiary",
      targetId: entry._id.toString()
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(entry.site.toString())).emit(_sharedTypes.SOCKET_EVENTS.DIARY_UPDATED, {
      diaryId: entry._id.toString(),
      siteId: entry.site.toString()
    });
    return entry.populate("site", "name code").populate("createdBy", "name");
  },

  async list(filter) {
    const query = {};
    if (filter.site) query.site = new mongoose.Types.ObjectId(filter.site);
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) query.date.$gte = new Date(filter.from);
      if (filter.to) query.date.$lte = new Date(filter.to);
    }
    return _Finance.SiteDiary.find(query)
      .populate("site", "name code")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ date: -1 })
      .limit(500);
  },

  async get(id) {
    const entry = await _Finance.SiteDiary.findById(id)
      .populate("site", "name code")
      .populate("createdBy", "name")
      .populate("updatedBy", "name");
    if (!entry) throw _AppError.AppError.notFound("Diary entry not found");
    return entry;
  },

  async remove(id, actorId) {
    const entry = await this.get(id);
    if (!entry) throw new Error("Entry not found");
    await _Finance.SiteDiary.findByIdAndDelete(id);
    await _audit.AuditService.log({ actor: actorId, action: "DIARY_DELETED", targetType: "SiteDiary", targetId: id });
    return { ok: true };
  }
};
