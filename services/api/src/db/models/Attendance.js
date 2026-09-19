Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Attendance = void 0;
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const attendanceSchema = new _mongoose.Schema({
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
  date: {
    type: Date,
    required: true,
    index: true
  },
  // stored at midnight UTC for the calendar day
  status: {
    type: String,
    enum: _sharedTypes.ATTENDANCE_STATUS,
    required: true
  },
  hoursWorked: {
    type: Number,
    default: 0,
    min: 0,
    max: 24
  },
  overtimeHours: {
    type: Number,
    default: 0,
    min: 0,
    max: 24
  },
  recordedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  locked: {
    type: Boolean,
    default: false
  },
  correctionOf: {
    type: _mongoose.Types.ObjectId,
    ref: "Attendance",
    default: null
  }
}, {
  timestamps: true
});

// One attendance record per worker per day, unless it's an explicit correction chain.
attendanceSchema.index({
  worker: 1,
  date: 1
}, {
  unique: true,
  partialFilterExpression: {
    correctionOf: null
  }
});
const Attendance = exports.Attendance = (0, _mongoose.model)("Attendance", attendanceSchema);