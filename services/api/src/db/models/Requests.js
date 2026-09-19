Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KharchiRequest = exports.AdvanceRequest = void 0;
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const advanceRequestSchema = new _mongoose.Schema({
  worker: {
    type: _mongoose.Types.ObjectId,
    ref: "WorkerProfile",
    required: true,
    index: true
  },
  amountPaise: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true
  },
  requestedDate: {
    type: Date,
    required: true
  },
  submittedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  attachment: {
    fileId: String,
    url: String
  },
  status: {
    type: String,
    enum: _sharedTypes.REQUEST_STATUS,
    default: "REQUESTED",
    index: true
  },
  approvedAmountPaise: {
    type: Number
  },
  rejectionReason: {
    type: String
  },
  approvedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  },
  paymentProof: {
    fileId: String,
    url: String
  }
}, {
  timestamps: true
});
const AdvanceRequest = exports.AdvanceRequest = (0, _mongoose.model)("AdvanceRequest", advanceRequestSchema);
const kharchiRequestSchema = new _mongoose.Schema({
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
  amountPaise: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  attachment: {
    fileId: String,
    url: String
  },
  submittedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: _sharedTypes.REQUEST_STATUS,
    default: "REQUESTED",
    index: true
  },
  approvedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  },
  rejectionReason: {
    type: String
  }
}, {
  timestamps: true
});
const KharchiRequest = exports.KharchiRequest = (0, _mongoose.model)("KharchiRequest", kharchiRequestSchema);