Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createApp = createApp;
var _express = _interopRequireDefault(require("express"));
var _cors = _interopRequireDefault(require("cors"));
var _helmet = _interopRequireDefault(require("helmet"));
var _pinoHttp = _interopRequireDefault(require("pino-http"));
var _env = require("./config/env");
var _logger = require("./config/logger");
var _rateLimit = require("./middleware/rateLimit");
var _errorHandler = require("./middleware/errorHandler");
var _auth = require("./modules/auth/auth.routes");
var _permissions = require("./modules/permissions/permissions.routes");
var _user = require("./modules/users/user.routes");
var _workType = require("./modules/workTypes/workType.routes");
var _site = require("./modules/sites/site.routes");
var _worker = require("./modules/workers/worker.routes");
var _attendance = require("./modules/attendance/attendance.routes");
var _notification = require("./modules/notifications/notification.routes");
var _salary = require("./modules/salary/salary.routes");
var _salaryRules = require("./modules/salary/salaryRules.routes");
var _advance = require("./modules/advances/advance.routes");
var _kharchi = require("./modules/kharchi/kharchi.routes");
var _finance = require("./modules/finance/finance.routes");
var _support = require("./modules/support/support.routes");
var _auditLog = require("./modules/auditLogs/auditLog.routes");
var _report = require("./modules/reports/report.routes");
var _role = require("./modules/permissions/role.routes");
var _supplier = require("./modules/suppliers/supplier.routes");
var _material = require("./modules/materials/material.routes");
var _equipment = require("./modules/equipment/equipment.routes");
var _diary = require("./modules/diary/diary.routes");
var _media = require("./modules/media/media.routes");
var _openapi = require("./config/openapi");
var _corsConfig = require("./config/cors");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function createApp() {
  const app = (0, _express.default)();
  // Helmet's defaults (Referrer-Policy: no-referrer, CORP: same-origin) break
  // two different things that both look like "the video will not play":
  //   - no-referrer makes YouTube embeds return error 153 if this process also
  //     serves the admin HTML (or a reverse proxy copies these headers onto it)
  //   - CORP same-origin blocks the admin origin from reading API responses,
  //     which the browser reports as a CORS failure on /media/youtube/search
  app.use((0, _helmet.default)({
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin"
    },
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    },
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups"
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use((0, _cors.default)({
    origin: (0, _corsConfig.corsOriginDelegate)(_env.env.CORS_ORIGIN),
    credentials: true
  }));
  app.use(_express.default.json({
    limit: "2mb"
  }));
  app.use(_express.default.urlencoded({
    extended: true,
    limit: "2mb"
  }));
  app.use((0, _pinoHttp.default)({
    logger: _logger.logger
  }));
  app.use(_rateLimit.generalApiRateLimit);
  app.get("/health", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        env: _env.env.NODE_ENV
      }
    });
  });
  // Public, auth-free sibling of /health under the versioned prefix. The
  // admin web app polls this (through the Vite /api proxy) to show an
  // "API server unreachable" banner instead of failing every query silently.
  app.get("/api/v1/status", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        env: _env.env.NODE_ENV,
        time: new Date().toISOString()
      }
    });
  });
  (0, _openapi.mountApiDocs)(app); // GET /api/v1/docs (Swagger UI), /api/v1/openapi.json

  app.use("/api/v1/auth", _auth.authRouter);
  app.use("/api/v1/permissions", _permissions.permissionsRouter);
  app.use("/api/v1/users", _user.usersRouter);
  app.use("/api/v1/work-types", _workType.workTypesRouter);
  app.use("/api/v1/sites", _site.sitesRouter);
  app.use("/api/v1/workers", _worker.workersRouter);
  app.use("/api/v1/attendance", _attendance.attendanceRouter);
  app.use("/api/v1/notifications", _notification.notificationsRouter);
  app.use("/api/v1/salary", _salary.salaryRouter);
  app.use("/api/v1/payroll", _salary.payrollRouter);
  app.use("/api/v1/settings/salary-rules", _salaryRules.salaryRulesRouter);
  app.use("/api/v1/advances", _advance.advancesRouter);
  app.use("/api/v1/kharchi", _kharchi.kharchiRouter);
  app.use("/api/v1/finance", _finance.financeRouter);
  app.use("/api/v1/support", _support.supportRouter);
  app.use("/api/v1/audit-logs", _auditLog.auditLogsRouter);
  app.use("/api/v1/reports", _report.reportsRouter);
  app.use("/api/v1/roles", _role.rolesRouter);
  app.use("/api/v1/suppliers", _supplier.supplierRouter);
  app.use("/api/v1/materials", _material.materialRouter);
  app.use("/api/v1/equipment", _equipment.equipmentRouter);
  app.use("/api/v1/site-diary", _diary.diaryRouter);
  app.use("/api/v1/media", _media.mediaRouter);
  // Every module from the architecture doc (§33 API design) is now mounted.

  app.use(_errorHandler.notFoundHandler);
  app.use(_errorHandler.errorHandler);
  return app;
}