Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
const notificationSchema = new _mongoose.Schema({
  recipient: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  data: {
    type: _mongoose.Schema.Types.Mixed
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});
notificationSchema.index({
  recipient: 1,
  read: 1,
  createdAt: -1
});
exports.Notification = (0, _mongoose.model)("Notification", notificationSchema);