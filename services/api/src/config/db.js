Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
var _mongoose = _interopRequireDefault(require("mongoose"));
var _env = require("./env");
var _logger = require("./logger");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
async function connectDB() {
  _mongoose.default.set("strictQuery", true);
  _mongoose.default.connection.on("connected", () => _logger.logger.info("MongoDB connected"));
  _mongoose.default.connection.on("error", err => _logger.logger.error({
    err
  }, "MongoDB connection error"));
  _mongoose.default.connection.on("disconnected", () => _logger.logger.warn("MongoDB disconnected"));
  await _mongoose.default.connect(_env.env.MONGODB_URI);
}
async function disconnectDB() {
  await _mongoose.default.disconnect();
}