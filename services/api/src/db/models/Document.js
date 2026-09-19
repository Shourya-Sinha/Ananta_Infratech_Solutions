Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const documentSchema = new _mongoose.Schema({
  owner: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: _sharedTypes.DOCUMENT_TYPE,
    required: true
  },
  imagekitFileId: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  verificationStatus: {
    type: String,
    enum: _sharedTypes.DOCUMENT_VERIFICATION_STATUS,
    default: "PENDING"
  },
  verifiedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  },
  verifiedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  metadata: {
    mimeType: {
      type: String
    },
    sizeBytes: {
      type: Number
    }
  }
}, {
  timestamps: true
});
exports.DocumentModel = (0, _mongoose.model)("Document", documentSchema);