Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const salaryLedgerSchema = new _mongoose.Schema({
  worker: {
    type: _mongoose.Types.ObjectId,
    ref: "WorkerProfile",
    required: true,
    index: true
  },
  site: {
    type: _mongoose.Types.ObjectId,
    ref: "Site",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: _sharedTypes.SALARY_LEDGER_TYPE,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  creditPaise: {
    type: _mongoose.Schema.Types.Decimal128,
    default: "0"
  },
  debitPaise: {
    type: _mongoose.Schema.Types.Decimal128,
    default: "0"
  },
  runningBalancePaise: {
    type: _mongoose.Schema.Types.Decimal128,
    required: true
  },
  reference: {
    type: String
  },
  // links to Attendance/AdvanceRequest/KharchiRequest id
  createdBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});
salaryLedgerSchema.index({
  worker: 1,
  date: 1
});
salaryLedgerSchema.index({
  worker: 1,
  createdAt: 1
});
exports.SalaryLedger = (0, _mongoose.model)("SalaryLedger", salaryLedgerSchema);