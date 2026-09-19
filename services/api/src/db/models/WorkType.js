Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
const workTypeSchema = new _mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  defaultDailyRatePaise: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});
exports.WorkType = (0, _mongoose.model)("WorkType", workTypeSchema);