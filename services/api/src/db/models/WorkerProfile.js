Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const workerProfileSchema = new _mongoose.Schema({
  user: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ["MALE", "FEMALE", "OTHER"]
  },
  address: {
    type: String
  },
  emergencyContact: {
    name: {
      type: String
    },
    phone: {
      type: String
    },
    relation: {
      type: String
    }
  },
  profilePhoto: {
    fileId: {
      type: String
    },
    url: {
      type: String
    }
  },
  workType: {
    type: _mongoose.Types.ObjectId,
    ref: "WorkType",
    index: true
  },
  currentSite: {
    type: _mongoose.Types.ObjectId,
    ref: "Site",
    index: true
  },
  verificationStatus: {
    type: String,
    enum: _sharedTypes.WORKER_VERIFICATION_STATUS,
    default: "PENDING_VERIFICATION",
    index: true
  },
  verificationNotes: {
    type: String
  },
  createdBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});
exports.WorkerProfile = (0, _mongoose.model)("WorkerProfile", workerProfileSchema);