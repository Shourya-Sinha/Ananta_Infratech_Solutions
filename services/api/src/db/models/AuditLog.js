Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
const auditLogSchema = new _mongoose.Schema({
  actor: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  targetType: {
    type: String,
    required: true,
    index: true
  },
  targetId: {
    type: String,
    required: true,
    index: true
  },
  before: {
    type: _mongoose.Schema.Types.Mixed
  },
  after: {
    type: _mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});

// Append-only: block updates/deletes at the application layer by convention —
// only AuditService.log() should ever write here.

exports.AuditLog = (0, _mongoose.model)("AuditLog", auditLogSchema);