Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
const sessionSchema = new _mongoose.Schema({
  user: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true
  },
  refreshTokenHash: {
    type: String,
    required: true,
    select: false
  },
  issuedAt: {
    type: Date,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  lastActivityAt: {
    type: Date,
    required: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  revoked: {
    type: Boolean,
    default: false
  },
  revokedAt: {
    type: Date
  }
}, {
  timestamps: true
});
sessionSchema.index({
  user: 1,
  deviceId: 1
});
exports.Session = (0, _mongoose.model)("Session", sessionSchema);