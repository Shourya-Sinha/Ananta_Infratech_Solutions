Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Role = exports.ROLE_KEY_PATTERN = void 0;
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");

/**
 * A Role is either one of the built-in system roles (keys in ROLE_KEYS) or a
 * custom role created by a Super Admin. Every role has a `baseRole` — one of
 * the built-in ROLE_KEYS — which decides record-level scope (e.g. a WORKER-base
 * role only sees its own salary, a MANAGER-base role only sees managed sites).
 * Permissions for a role are looked up by its own `key`, so two custom roles
 * can share a base but grant different capabilities.
 */
const ROLE_KEY_PATTERN = exports.ROLE_KEY_PATTERN = /^[A-Z][A-Z0-9_]{2,39}$/;
const roleSchema = new _mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [ROLE_KEY_PATTERN, "Role key must be 3-40 chars: A-Z, 0-9, underscore, starting with a letter."]
  },
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  description: {
    type: String,
    default: "",
    trim: true,
    maxlength: 300
  },
  baseRole: {
    type: String,
    enum: _sharedTypes.ROLE_KEYS,
    required: true
  },
  isSystemRole: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Built-in roles are identified by their key; their base is themselves.
roleSchema.pre("validate", function (next) {
  if (this.isNew) {
    const isBuiltIn = _sharedTypes.ROLE_KEYS.includes(this.key);
    this.isSystemRole = isBuiltIn;
    if (!this.baseRole) this.baseRole = isBuiltIn ? this.key : "WORKER";
  }
  next();
});
exports.Role = (0, _mongoose.model)("Role", roleSchema);
