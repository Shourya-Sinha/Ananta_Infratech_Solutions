Object.defineProperty(exports, "__esModule", {
  value: true,
});
exports.sitesRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _site = require("./site.service");
var _WorkerProfile = require("../../db/models/WorkerProfile");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
var _sharedTypes = require("@ananta/shared-types");
var _gateway = require("../../sockets/gateway");
const sitesRouter = (exports.sitesRouter = (0, _express.Router)());
sitesRouter.use(_authenticate.authenticate);
sitesRouter.get(
  "/",
  (0, _rbac.requirePermission)("site.read"),
  (0, _errorHandler.asyncHandler)(async (req, res) => {
    const { role, userId } = req.auth;

    // Record-level scoping: SUPER_ADMIN sees all sites; MANAGER sees only
    // sites they manage; WORKER sees only their currently assigned site.
    if (role === "MANAGER") {
      const sites = await _site.SiteService.listForManager(userId);
      const body = {
        success: true,
        data: sites,
      };
      return res.json(body);
    }
    if (role === "WORKER") {
      const profile = await _WorkerProfile.WorkerProfile.findOne({
        user: userId,
      });
      if (!profile?.currentSite) {
        const body = {
          success: true,
          data: [],
        };
        return res.json(body);
      }
      const site = await _site.SiteService.getById(
        profile.currentSite.toString(),
      );
      const body = {
        success: true,
        data: [site],
      };
      return res.json(body);
    }
    const query = _zod.z
      .object({
        status: _zod.z.enum(_sharedTypes.SITE_STATUS).optional(),
      })
      .parse(req.query);
    const sites = await _site.SiteService.list(query);
    const body = {
      success: true,
      data: sites,
    };
    res.json(body);
  }),
);
sitesRouter.get(
  "/:id",
  (0, _rbac.requirePermission)("site.read"),
  (0, _errorHandler.asyncHandler)(async (req, res) => {
    const { role, userId } = req.auth;
    const site = await _site.SiteService.getById(req.params.id);
    if (role === "MANAGER" && site.manager?.toString() !== userId) {
      throw _AppError.AppError.forbidden("You don't manage this site.");
    }
    if (role === "WORKER") {
      const profile = await _WorkerProfile.WorkerProfile.findOne({
        user: userId,
      });
      if (!profile || profile.currentSite?.toString() !== site._id.toString()) {
        throw _AppError.AppError.forbidden("You aren't assigned to this site.");
      }
    }
    const body = {
      success: true,
      data: site,
    };
    res.json(body);
  }),
);
const createSiteSchema = _zod.z.object({
  name: _zod.z.string().trim().min(2).max(150),
  code: _zod.z.string().trim().min(2).max(20),
  address: _zod.z.string().trim().min(5).max(300),
  client: _zod.z.string().trim().optional(),
  projectType: _zod.z.string().trim().optional(),
  startDate: _zod.z.string().date().optional(),
  expectedCompletionDate: _zod.z.string().date().optional(),
  manager: _zod.z.string().optional(),
  budgetRupees: _zod.z.number().positive().optional(),
  description: _zod.z.string().trim().max(1000).optional(),
});
// sitesRouter.post("/", (0, _rbac.requirePermission)("site.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
//   const input = createSiteSchema.parse(req.body);
//   const site = await _site.SiteService.create(input, req.auth.userId);
//   (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.SITE_CREATED, {
//     siteId: site._id.toString()
//   });
//   const body = {
//     success: true,
//     data: site
//   };
//   res.status(201).json(body);
// }));

sitesRouter.post(
  "/",
  _rbac.requirePermission("site.create"),
  (0, _errorHandler.asyncHandler)(async (req, res) => {
    console.log("CREATE SITE BODY:", JSON.stringify(req.body, null, 2));

    const result = createSiteSchema.safeParse(req.body);

    if (!result.success) {
      console.log(
        "CREATE SITE VALIDATION ERROR:",
        JSON.stringify(result.error.flatten(), null, 2),
      );

      return res.status(422).json({
        success: false,
        message: "Invalid site data",
        errors: result.error.flatten(),
      });
    }

    const input = result.data;

    const site = await _site.SiteService.create(input, req.auth.userId);

    (0, _gateway.getIO)()
      .to(_sharedTypes.ROOMS.admin())
      .emit(_sharedTypes.SOCKET_EVENTS.SITE_CREATED, {
        siteId: site._id.toString(),
      });

    const body = {
      success: true,
      data: site,
    };

    res.status(201).json(body);
  }),
);

const updateSiteSchema = createSiteSchema.partial().extend({
  status: _zod.z.enum(_sharedTypes.SITE_STATUS).optional(),
});
sitesRouter.patch(
  "/:id",
  (0, _rbac.requirePermission)("site.update"),
  (0, _errorHandler.asyncHandler)(async (req, res) => {
    const input = updateSiteSchema.parse(req.body);
    const site = await _site.SiteService.update(
      req.params.id,
      input,
      req.auth.userId,
    );
    (0, _gateway.getIO)()
      .to(_sharedTypes.ROOMS.admin())
      .to(_sharedTypes.ROOMS.site(site._id.toString()))
      .emit(_sharedTypes.SOCKET_EVENTS.SITE_UPDATED, {
        siteId: site._id.toString(),
      });
    const body = {
      success: true,
      data: site,
    };
    res.json(body);
  }),
);
sitesRouter.delete(
  "/:id",
  (0, _rbac.requirePermission)("site.delete"),
  (0, _errorHandler.asyncHandler)(async (req, res) => {
    const result = await _site.SiteService.delete(
      req.params.id,
      req.auth.userId,
    );
    const body = {
      success: true,
      data: result,
    };
    res.json(body);
  }),
);
