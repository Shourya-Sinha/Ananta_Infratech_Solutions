"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierService = void 0;
const _Finance = require("../../db/models/Finance");
const _AppError = require("../../errors/AppError");
const _audit = require("../auditLogs/audit.service");
const _gateway = require("../../sockets/gateway");
const _sharedTypes = require("@ananta/shared-types");

exports.SupplierService = {
  async create(input, actorId) {
    const supplier = await _Finance.Supplier.create({
      name: input.name,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email,
      address: input.address,
      gstin: input.gstin,
      category: input.category ?? "MATERIAL",
      notes: input.notes,
      createdBy: actorId
    });
    await _audit.AuditService.log({
      actor: actorId,
      action: "SUPPLIER_CREATED",
      targetType: "Supplier",
      targetId: supplier._id.toString(),
      after: { name: input.name, category: input.category }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.SUPPLIER_CREATED, { supplierId: supplier._id.toString() });
    return supplier;
  },

  async list(filter) {
    const query = {};
    if (filter.category) query.category = filter.category;
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: "i" } },
        { contactPerson: { $regex: filter.search, $options: "i" } },
        { phone: { $regex: filter.search, $options: "i" } }
      ];
    }
    return _Finance.Supplier.find(query).sort({ name: 1 });
  },

  async get(id) {
    const s = await _Finance.Supplier.findById(id);
    if (!s) throw _AppError.AppError.notFound("Supplier not found");
    return s;
  },

  async update(id, input, actorId) {
    const supplier = await this.get(id);
    Object.assign(supplier, input);
    await supplier.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "SUPPLIER_UPDATED",
      targetType: "Supplier",
      targetId: supplier._id.toString()
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.SUPPLIER_UPDATED, { supplierId: supplier._id.toString() });
    return supplier;
  },

  async remove(id, actorId) {
    const supplier = await this.get(id);
    // Check if any materials still reference this supplier
    const materialCount = await _Finance.Material.countDocuments({ supplier: supplier._id });
    if (materialCount > 0) {
      throw _AppError.AppError.conflict(`Cannot delete supplier — ${materialCount} material(s) still reference it. Reassign or delete those materials first.`);
    }
    await _Finance.Supplier.findByIdAndDelete(id);
    await _audit.AuditService.log({
      actor: actorId,
      action: "SUPPLIER_DELETED",
      targetType: "Supplier",
      targetId: id
    });
    return { ok: true };
  }
};
