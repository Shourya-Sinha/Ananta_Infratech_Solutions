Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.redis = void 0;
var _ioredis = _interopRequireDefault(require("ioredis"));
var _env = require("./env");
var _logger = require("./logger");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const redis = exports.redis = new _ioredis.default(_env.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false
});
redis.on("connect", () => _logger.logger.info("Redis connected"));
redis.on("error", err => _logger.logger.error({
  err
}, "Redis connection error"));