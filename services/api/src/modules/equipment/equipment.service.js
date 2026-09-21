"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EquipmentService = void 0;
const _Finance = require("../../db/models/Finance");
const _Site = require("../../db/models/Site");
const _AppError = require("../../errors/AppError");
const _audit = require("../auditLogs/audit.service");
const _gateway = require("../../sockets/gateway");
const _sharedTypes = require("@ananta/shared-types");
const _utils = require("@ananta/utils");
const mongoose = require("mongoose");

exports.EquipmentService = {
  async create(input, actorId) {
    const eq = await _Finance.Equipment.create({
      name: input.name,
      code: input.code,
      category: input.category,
      serialNumber: input.serialNumber,
      purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
      purchaseRatePaise: input.purchaseRateRupees != null ? _utils.rupeesToPaise(input.purchaseRateRupees) : 0,
      condition: input.condition ?? "GOOD",
      status: "AVAILABLE",
      notes: input.notes,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "EQUIPMENT_CREATED",
      targetType: "Equipment",
      targetId: eq._id.toString(),
      after: { name: input.name }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.EQUIPMENT_CREATED, { equipmentId: eq._id.toString() });
    return eq;
  },

  async list(filter) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.site) {
      const assigns = await _Finance.EquipmentAssignment.find({
        site: new mongoose.Types.ObjectId(filter.site),
        dateReturned: null
      }).distinct("equipment");
      query._id = { $in: assigns };
    }
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: "i" } },
        { code: { $regex: filter.search, $options: "i" } },
        { serialNumber: { $regex: filter.search, $options: "i" } }
      ];
    }
    return _Finance.Equipment.find(query).sort({ name: 1 });
  },

  async get(id) {
    const eq = await _Finance.Equipment.findById(id);
    if (!eq) throw _AppError.AppError.notFound("Equipment not found");
    return eq;
  },

  async update(id, input, actorId) {
    const eq = await this.get(id);
    if (input.purchaseRateRupees != null) {
      eq.purchaseRatePaise = _utils.rupeesToPaise(input.purchaseRateRupees);
      delete input.purchaseRateRupees;
    }
    Object.assign(eq, input);
    await eq.save();
    await _audit.AuditService.log({ actor: actorId, action: "EQUIPMENT_UPDATED", targetType: "Equipment", targetId: eq._id.toString() });
    return eq;
  },

  async remove(id, actorId) {
    const eq = await this.get(id);
    if (eq.status === "ASSIGNED") throw _AppError.AppError.conflict("Cannot delete assigned equipment. Return it first.");
    await _Finance.Equipment.findByIdAndDelete(id);
    await _audit.AuditService.log({ actor: actorId, action: "EQUIPMENT_DELETED", targetType: "Equipment", targetId: id });
    return { ok: true };
  },

  async assign(input, actorId) {
    const eq = await this.get(input.equipmentId);
    const site = await _Site.Site.findById(input.siteId);
    if (!site) throw _AppError.AppError.notFound("Site not found");
    if (eq.status === "ASSIGNED") {
      // Optionally auto-return existing assignment
      await _Finance.EquipmentAssignment.findOneAndUpdate(
        { equipment: eq._id, dateReturned: null },
        { dateReturned: new Date(), conditionIn: eq.condition }
      );
    }
    eq.status = "ASSIGNED";
    await eq.save();
    const assignment = await _Finance.EquipmentAssignment.create({
      equipment: eq._id,
      site: site._id,
      assignedTo: input.assignedTo,
      dateAssigned: new Date(input.dateAssigned ?? new Date()),
      conditionOut: input.conditionOut ?? "GOOD",
      note: input.note,
      assignedBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "EQUIPMENT_ASSIGNED",
      targetType: "EquipmentAssignment",
      targetId: assignment._id.toString(),
      after: { equipmentId: eq._id.toString(), siteId: site._id.toString() }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(site._id.toString())).emit(_sharedTypes.SOCKET_EVENTS.EQUIPMENT_ASSIGNED, {
      equipmentId: eq._id.toString(),
      assignmentId: assignment._id.toString(),
      siteId: site._id.toString()
    });
    return assignment.populate("equipment", "name code category").populate("site", "name code");
  },

  async returnEquipment(assignmentId, input, actorId) {
    const a = await _Finance.EquipmentAssignment.findById(assignmentId);
    if (!a) throw _AppError.AppError.notFound("Assignment not found");
    if (a.dateReturned) throw _AppError.AppError.conflict("Equipment already returned.");
    a.dateReturned = new Date();
    a.conditionIn = input.conditionIn ?? "GOOD";
    if (input.note) a.note = (a.note || "") + " | Return note: " + input.note;
    await a.save();
    const eq = await _Finance.Equipment.findById(a.equipment);
    if (eq) {
      eq.status = "AVAILABLE";
      if (input.conditionIn) eq.condition = input.conditionIn;
      await eq.save();
    }
    await _audit.AuditService.log({ actor: actorId, action: "EQUIPMENT_RETURNED", targetType: "EquipmentAssignment", targetId: a._id.toString() });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.site(a.site.toString())).emit(_sharedTypes.SOCKET_EVENTS.EQUIPMENT_RETURNED, {
      equipmentId: a.equipment.toString(),
      assignmentId: a._id.toString(),
      siteId: a.site.toString()
    });
    return a;
  },

  async listAssignments(filter) {
    const query = {};
    if (filter.site) query.site = new mongoose.Types.ObjectId(filter.site);
    if (filter.active === "true") query.dateReturned = null;
    return _Finance.EquipmentAssignment.find(query)
      .populate("equipment", "name code category condition")
      .populate("site", "name code")
      .sort({ dateAssigned: -1 })
      .limit(500);
  }
};
