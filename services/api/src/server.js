var _nodeHttp = _interopRequireDefault(require("node:http"));
var _app = require("./app");
var _env = require("./config/env");
var _logger = require("./config/logger");
var _db = require("./config/db");
var _syncPermissions = require("./db/syncPermissions");
var _redis = require("./config/redis");
var _gateway = require("./sockets/gateway");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
async function main() {
  await (0, _db.connectDB)();
  // Gap-fill any permission keys added to the registry since this database
  // was seeded (missing rows surface as 403s, even for SUPER_ADMIN). The
  // sync only inserts missing rows and never rewrites admin toggles; a
  // failure here must never prevent the API from starting.
  try {
    await (0, _syncPermissions.syncPermissions)();
  } catch (err) {
    _logger.logger.warn({ err }, "Startup permission sync failed, continuing without it");
  }
  const app = (0, _app.createApp)();
  const httpServer = _nodeHttp.default.createServer(app);
  (0, _gateway.initSocketGateway)(httpServer);
  httpServer.listen(_env.env.PORT, () => {
    _logger.logger.info(`Ananta API listening on port ${_env.env.PORT} [${_env.env.NODE_ENV}]`);
  });
  const shutdown = async signal => {
    _logger.logger.info(`${signal} received, shutting down gracefully`);
    httpServer.close();
    await (0, _db.disconnectDB)();
    _redis.redis.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
main().catch(err => {
  _logger.logger.error({
    err
  }, "Fatal error during startup");
  process.exit(1);
});