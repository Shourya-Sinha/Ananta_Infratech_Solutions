Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getIO = getIO;
exports.initSocketGateway = initSocketGateway;
var _socket = require("socket.io");
var _token = require("../modules/auth/token.service");
var _sharedTypes = require("@ananta/shared-types");
var _logger = require("../config/logger");
var _env = require("../config/env");
var _SiteAssignment = require("../db/models/SiteAssignment");
var _WorkerProfile = require("../db/models/WorkerProfile");
var _Site = require("../db/models/Site");
let io;
function initSocketGateway(httpServer) {
  io = new _socket.Server(httpServer, {
    cors: {
      origin: _env.env.CORS_ORIGIN,
      credentials: true
    }
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Missing auth token"));
      const payload = _token.TokenService.verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });
  io.on("connection", async socket => {
    const {
      userId,
      role
    } = socket.data;
    _logger.logger.debug({
      userId,
      role
    }, "Socket connected");

    // Every user joins their personal room (for notifications, session events).
    await socket.join(_sharedTypes.ROOMS.user(userId));
    if (role === "SUPER_ADMIN") {
      await socket.join(_sharedTypes.ROOMS.admin());
    }
    if (role === "MANAGER") {
      await socket.join(_sharedTypes.ROOMS.manager(userId));
      // Join every site room this manager currently manages.
      const managedSites = await _Site.Site.find({
        manager: userId
      }).select("_id");
      for (const site of managedSites) {
        await socket.join(_sharedTypes.ROOMS.site(site._id.toString()));
      }
    }
    if (role === "WORKER") {
      const profile = await _WorkerProfile.WorkerProfile.findOne({
        user: userId
      });
      if (profile) {
        await socket.join(_sharedTypes.ROOMS.worker(profile._id.toString()));
        const activeAssignment = await _SiteAssignment.SiteAssignment.findOne({
          worker: profile._id,
          status: "ACTIVE"
        });
        if (activeAssignment) {
          await socket.join(_sharedTypes.ROOMS.site(activeAssignment.site.toString()));
        }
      }
    }
    socket.on("disconnect", () => {
      _logger.logger.debug({
        userId
      }, "Socket disconnected");
    });
  });
  return io;
}
function getIO() {
  if (!io) throw new Error("Socket.IO not initialized — call initSocketGateway first");
  return io;
}