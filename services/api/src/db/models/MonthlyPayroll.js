Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const monthlyPayrollSchema = new _mongoose.Schema({
  worker: {
    type: _mongoose.Types.ObjectId,
    ref: "WorkerProfile",
    required: true,
    index: true
  },
  month: {
    type: String,
    required: true
  },
  // "YYYY-MM"
  grossEarningsPaise: {
    type: Number,
    default: 0
  },
  overtimeEarningsPaise: {
    type: Number,
    default: 0
  },
  advanceDeductionsPaise: {
    type: Number,
    default: 0
  },
  kharchiDeductionsPaise: {
    type: Number,
    default: 0
  },
  otherDeductionsPaise: {
    type: Number,
    default: 0
  },
  netSalaryPaise: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: _sharedTypes.PAYROLL_STATUS,
    default: "DRAFT",
    index: true
  },
  finalizedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  },
  finalizedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  }
}, {
  timestamps: true
});
monthlyPayrollSchema.index({
  worker: 1,
  month: 1
}, {
  unique: true
});
exports.MonthlyPayroll = (0, _mongoose.model)("MonthlyPayroll", monthlyPayrollSchema);