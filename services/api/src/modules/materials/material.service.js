"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialService = void 0;
const _Finance = require("../../db/models/Finance");
const _Site = require("../../db/models/Site");
const _utils = require("@ananta/utils");
const _AppError = require("../../errors/AppError");
const _audit = require("../auditLogs/audit.service");
const _gateway = require("../../sockets/gateway");
const _sharedTypes = require("@ananta/shared-types");
const mongoose = require("mongoose");

exports.MaterialService = {
  async create(input, actorId) {
    const material = await _Finance.Material.create({
      name: input.name,
      code: input.code,
      unit: input.unit ?? "KG",
      category: input.category,
      currentStock: input.initialStock ?? 0,
      reorderLevel: input.reorderLevel ?? 0,
      lastPurchaseRatePaise: input.lastPurchaseRatePaise != null ? _utils.rupeesToPaise(input.lastPurchaseRatePaise) : 0,
      supplier: input.supplier || undefined,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "MATERIAL_CREATED",
      targetType: "Material",
      targetId: material._id.toString(),
      after: { name: input.name, unit: input.unit }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.MATERIAL_CREATED, { materialId: material._id.toString() });
    return material;
  },

  async list(filter) {
    const query = {};
    if (filter.category) query.category = filter.category;
    if (filter.lowStock === "true") query.$expr = { $lte: ["$currentStock", "$reorderLevel"] };
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: "i" } },
        { code: { $regex: filter.search, $options: "i" } }
      ];
    }
    return _Finance.Material.find(query).populate("supplier", "name phone").sort({ name: 1 });
  },

  async get(id) {
    const m = await _Finance.Material.findById(id).populate("supplier", "name phone");
    if (!m) throw _AppError.AppError.notFound("Material not found");
    return m;
  },

  async update(id, input, actorId) {
    const m = await this.get(id);
    if (input.lastPurchaseRateRupees != null) {
      m.lastPurchaseRatePaise = _utils.rupeesToPaise(input.lastPurchaseRateRupees);
      delete input.lastPurchaseRateRupees;
    }
    if (input.addStock != null) {
      m.currentStock = Number(m.currentStock || 0) + Number(input.addStock);
      delete input.addStock;
    }
    Object.assign(m, input);
    await m.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "MATERIAL_UPDATED",
      targetType: "Material",
      targetId: m._id.toString()
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.MATERIAL_UPDATED, { materialId: m._id.toString() });
    return m.populate("supplier", "name phone");
  },

  async remove(id, actorId) {
    const m = await this.get(id);
    const issueCount = await _Finance.MaterialIssue.countDocuments({ material: m._id });
    if (issueCount > 0) throw _AppError.AppError.conflict("Cannot delete material with issue history. Archive it instead.");
    await _Finance.Material.findByIdAndDelete(id);
    await _audit.AuditService.log({ actor: actorId, action: "MATERIAL_DELETED", targetType: "Material", targetId: id });
    return { ok: true };
  },

  async issue(input, actorId) {
    const material = await _Finance.Material.findById(input.materialId);
    if (!material) throw _AppError.AppError.notFound("Material not found");
    const site = await _Site.Site.findById(input.siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    const qty = Number(input.quantity);
    const isReturn = input.type === "RETURN";
    if (!isReturn && Number(material.currentStock) < qty) {
      throw _AppError.AppError.validation(`Insufficient stock. Available: ${material.currentStock} ${material.unit}`);
    }
    // Update stock
    material.currentStock = isReturn
      ? Number(material.currentStock) + qty
      : Number(material.currentStock) - qty;
    await material.save();
    const issue = await _Finance.MaterialIssue.create({
      material: material._id,
      site: site._id,
      quantity: qty,
      ratePaise: input.ratePaise ?? material.lastPurchaseRatePaise ?? 0,
      date: new Date(input.date),
      type: input.type ?? "ISSUE",
      issuedTo: input.issuedTo,
      reference: input.reference,
      note: input.note,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: isReturn ? "MATERIAL_RETURNED" : "MATERIAL_ISSUED",
      targetType: "MaterialIssue",
      targetId: issue._id.toString(),
      after: { materialId: material._id.toString(), quantity: qty, siteId: site._id.toString() }
    });
    const ev = isReturn ? _sharedTypes.SOCKET_EVENTS.MATERIAL_RETURNED : _sharedTypes.SOCKET_EVENTS.MATERIAL_ISSUED;
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).emit(ev, {
      materialId: material._id.toString(),
      issueId: issue._id.toString(),
      siteId: site._id.toString()
    });
    return issue.populate("material", "name unit code");
  },

  async listIssues(filter) {
    const query = {};
    if (filter.site) query.site = new mongoose.Types.ObjectId(filter.site);
    if (filter.material) query.material = new mongoose.Types.ObjectId(filter.material);
    if (filter.type) query.type = filter.type;
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) query.date.$gte = new Date(filter.from);
      if (filter.to) query.date.$lte = new Date(filter.to);
    }
    return _Finance.MaterialIssue.find(query)
      .populate("material", "name unit code category")
      .populate("site", "name code")
      .sort({ date: -1 })
      .limit(500);
  }
};
