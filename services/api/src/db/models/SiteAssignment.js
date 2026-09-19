Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const siteAssignmentSchema = new _mongoose.Schema({
  worker: {
    type: _mongoose.Types.ObjectId,
    ref: "WorkerProfile",
    required: true,
    index: true
  },
  site: {
    type: _mongoose.Types.ObjectId,
    ref: "Site",
    required: true,
    index: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    default: null
  },
  assignedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  reason: {
    type: String
  },
  status: {
    type: String,
    enum: _sharedTypes.SITE_ASSIGNMENT_STATUS,
    default: "ACTIVE",
    index: true
  }
}, {
  timestamps: true
});
siteAssignmentSchema.index({
  worker: 1,
  startDate: -1
});
siteAssignmentSchema.index({
  site: 1,
  status: 1
});
exports.SiteAssignment = (0, _mongoose.model)("SiteAssignment", siteAssignmentSchema);