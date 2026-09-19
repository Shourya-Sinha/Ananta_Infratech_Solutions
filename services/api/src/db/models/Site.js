Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const siteSchema = new _mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  client: {
    type: String
  },
  projectType: {
    type: String
  },
  startDate: {
    type: Date
  },
  expectedCompletionDate: {
    type: Date
  },
  status: {
    type: String,
    enum: _sharedTypes.SITE_STATUS,
    default: "PLANNING",
    index: true
  },
  manager: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    index: true
  },
  budgetPaise: {
    type: Number,
    min: 0
  },
  description: {
    type: String
  }
}, {
  timestamps: true
});
exports.Site = (0, _mongoose.model)("Site", siteSchema);