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
  // Individual pay rate set by Admin/Manager. Admin sets ONE basis
  // (salaryMode) + its amount; hourly/daily/monthly equivalents are always
  // derived by @ananta/utils deriveSalaryRates — never trust a client-sent
  // conversion. When all three are empty the work-type default daily rate
  // applies. Changing the rate only affects attendance posted AFTER the
  // change (past ledger entries are immutable history).
  salaryMode: {
    type: String,
    enum: ["HOURLY", "DAILY", "MONTHLY"]
  },
  hourlyRatePaise: {
    type: Number,
    min: 0
  },
  dailyRatePaise: {
    type: Number,
    min: 0
  },
  monthlySalaryPaise: {
    type: Number,
    min: 0
  },
  salaryRateUpdatedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  },
  salaryRateUpdatedAt: {
    type: Date
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