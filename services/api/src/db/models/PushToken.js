Object.defineProperty(exports, "__esModule", {
  value: true
});
var _mongoose = require("mongoose");
const pushTokenSchema = new _mongoose.Schema({
  user: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true
  },
  fcmToken: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});
pushTokenSchema.index({
  user: 1,
  deviceId: 1
}, {
  unique: true
});
exports.PushToken = (0, _mongoose.model)("PushToken", pushTokenSchema);