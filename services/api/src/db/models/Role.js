Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const roleSchema = new _mongoose.Schema({
  key: {
    type: String,
    enum: _sharedTypes.ROLE_KEYS,
    required: true,
    unique: true
  },
  label: {
    type: String,
    required: true
  },
  isSystemRole: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});
exports.Role = (0, _mongoose.model)("Role", roleSchema);