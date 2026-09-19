Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RolePermission = exports.Permission = void 0;
var _mongoose = require("mongoose");
const permissionSchema = new _mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  group: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});
const Permission = exports.Permission = (0, _mongoose.model)("Permission", permissionSchema);
const rolePermissionSchema = new _mongoose.Schema({
  role: {
    type: _mongoose.Types.ObjectId,
    ref: "Role",
    required: true
  },
  permission: {
    type: _mongoose.Types.ObjectId,
    ref: "Permission",
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});
rolePermissionSchema.index({
  role: 1,
  permission: 1
}, {
  unique: true
});
const RolePermission = exports.RolePermission = (0, _mongoose.model)("RolePermission", rolePermissionSchema);