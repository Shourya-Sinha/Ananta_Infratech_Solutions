Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const userSchema = new _mongoose.Schema({
  role: {
    type: _mongoose.Types.ObjectId,
    ref: "Role",
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    unique: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  status: {
    type: String,
    enum: _sharedTypes.USER_STATUS,
    default: "PENDING_VERIFICATION"
  },
  lastLoginAt: {
    type: Date
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});
exports.User = (0, _mongoose.model)("User", userSchema);