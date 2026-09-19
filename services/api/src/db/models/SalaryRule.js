Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
const salaryRuleSchema = new _mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: _mongoose.Schema.Types.Mixed,
    required: true
  },
  updatedBy: {
    type: _mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});
exports.SalaryRule = (0, _mongoose.model)("SalaryRule", salaryRuleSchema);