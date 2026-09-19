Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.workersRouter = void 0;
var _express = require("express");
var _multer = _interopRequireDefault(require("multer"));
var _zod = require("zod");
var _worker = require("./worker.service");
var _document = require("../documents/document.service");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _AppError = require("../../errors/AppError");
var _sharedTypes = require("@ananta/shared-types");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const upload = (0, _multer.default)({
  storage: _multer.default.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});
const workersRouter = exports.workersRouter = (0, _express.Router)();
workersRouter.use(_authenticate.authenticate);

// --- Listing / detail -------------------------------------------------

workersRouter.get("/", (0, _rbac.requirePermission)("worker.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    role,
    userId
  } = req.auth;
  if (role === "MANAGER") {
    const workers = await _worker.WorkerService.listForManager(userId);
    const body = {
      success: true,
      data: workers
    };
    return res.json(body);
  }
  if (role === "WORKER") {
    // A worker's own worker.read permission must never expose the full
    // roster — scope strictly to their own profile (record-level check,
    // same principle as architecture doc §4: permission key alone doesn't
    // imply record-level scope).
    const profile = await _worker.WorkerService.getByUserId(userId);
    const body = {
      success: true,
      data: [profile]
    };
    return res.json(body);
  }
  const query = _zod.z.object({
    site: _zod.z.string().optional(),
    workType: _zod.z.string().optional(),
    verificationStatus: _zod.z.enum(_sharedTypes.WORKER_VERIFICATION_STATUS).optional(),
    search: _zod.z.string().optional(),
    page: _zod.z.coerce.number().optional(),
    pageSize: _zod.z.coerce.number().optional()
  }).parse(req.query);
  const result = await _worker.WorkerService.list(query);
  const body = {
    success: true,
    data: result
  };
  res.json(body);
}));
workersRouter.get("/me", (0, _rbac.requirePermission)("worker.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  if (req.auth.role !== "WORKER") {
    throw _AppError.AppError.validation("This endpoint is only for the WORKER role. Use /workers/:id instead.");
  }
  const profile = await _worker.WorkerService.getByUserId(req.auth.userId);
  const body = {
    success: true,
    data: profile
  };
  res.json(body);
}));

/**
 * Self-service profile creation: a WORKER account selects their own work
 * type and creates their own WorkerProfile (registration Step 2, done by
 * the worker themselves — spec §7). Deliberately does NOT require
 * "worker.create" (WORKER accounts don't hold that permission by default,
 * it's for Managers/Admin registering someone else) — being authenticated
 * as WORKER with no existing profile yet is the only requirement, same
 * record-level-scope principle as /me/documents below.
 *
 * IMPORTANT: registered before "/:id" — see the ordering note on
 * "/me/documents" below for why this matters.
 */
workersRouter.post("/me", (0, _errorHandler.asyncHandler)(async (req, res) => {
  if (req.auth.role !== "WORKER") {
    throw _AppError.AppError.validation("This endpoint is only for the WORKER role. Managers/Admin use POST /workers instead.");
  }
  const {
    workTypeId
  } = _zod.z.object({
    workTypeId: _zod.z.string().min(1)
  }).parse(req.body);
  const profile = await _worker.WorkerService.selectWorkType({
    userId: req.auth.userId,
    workTypeId,
    createdBy: req.auth.userId
  });
  const body = {
    success: true,
    data: profile
  };
  res.status(201).json(body);
}));

/**
 * Self-service upload: a WORKER account uploads their OWN identity
 * documents during registration (spec §7 Step 4 — the worker does this
 * themselves from their own phone). Deliberately does NOT require
 * "worker.create" (a permission WORKER accounts don't hold by default) —
 * authentication plus owning the profile is the only requirement here,
 * matching the record-level-scope principle in architecture doc §4.
 *
 * IMPORTANT: this must be registered before "/:id/documents" below —
 * Express matches routes in registration order, and "/:id" would otherwise
 * greedily capture "me" as an id before this route is ever reached.
 */
workersRouter.post("/me/documents", upload.single("file"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  if (req.auth.role !== "WORKER") {
    throw _AppError.AppError.validation("This endpoint is only for the WORKER role.");
  }
  if (!req.file) throw _AppError.AppError.validation("No file uploaded.");
  const docType = _zod.z.enum(_sharedTypes.DOCUMENT_TYPE).parse(req.body.type);
  const doc = await _document.DocumentService.uploadAndRecord({
    owner: req.auth.userId,
    uploadedBy: req.auth.userId,
    type: docType,
    fileBuffer: req.file.buffer,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype
  });
  const body = {
    success: true,
    data: doc
  };
  res.status(201).json(body);
}));

/** A worker viewing their own uploaded documents (status, what's still needed). */
workersRouter.get("/me/documents", (0, _errorHandler.asyncHandler)(async (req, res) => {
  if (req.auth.role !== "WORKER") {
    throw _AppError.AppError.validation("This endpoint is only for the WORKER role.");
  }
  const docs = await _document.DocumentService.listForOwner(req.auth.userId);
  const body = {
    success: true,
    data: docs
  };
  res.json(body);
}));
workersRouter.get("/:id", (0, _rbac.requirePermission)("worker.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const worker = await _worker.WorkerService.getById(req.params.id);
  const body = {
    success: true,
    data: worker
  };
  res.json(body);
}));
workersRouter.get("/:id/assignments", (0, _rbac.requirePermission)("worker.read"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const history = await _worker.WorkerService.getAssignmentHistory(req.params.id);
  const body = {
    success: true,
    data: history
  };
  res.json(body);
}));

// --- Registration Step 2: work type selection --------------------------

const selectWorkTypeSchema = _zod.z.object({
  userId: _zod.z.string().min(1),
  workTypeId: _zod.z.string().min(1)
});
workersRouter.post("/", (0, _rbac.requirePermission)("worker.create"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = selectWorkTypeSchema.parse(req.body);
  const profile = await _worker.WorkerService.selectWorkType({
    ...input,
    createdBy: req.auth.userId
  });
  const body = {
    success: true,
    data: profile
  };
  res.status(201).json(body);
}));

// --- Registration Step 4: document upload (admin/manager on behalf of worker) ---

workersRouter.post("/:id/documents", (0, _rbac.requirePermission)("worker.create"), upload.single("file"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  if (!req.file) throw _AppError.AppError.validation("No file uploaded.");
  const docType = _zod.z.enum(_sharedTypes.DOCUMENT_TYPE).parse(req.body.type);
  const worker = await _worker.WorkerService.getById(req.params.id);
  const doc = await _document.DocumentService.uploadAndRecord({
    owner: worker.user._id.toString(),
    uploadedBy: req.auth.userId,
    type: docType,
    fileBuffer: req.file.buffer,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype
  });
  const body = {
    success: true,
    data: doc
  };
  res.status(201).json(body);
}));

// --- Verification workflow ----------------------------------------------

workersRouter.post("/:id/verify-documents", (0, _rbac.requirePermission)("worker.verify"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const profile = await _worker.WorkerService.verifyDocuments(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: profile
  };
  res.json(body);
}));
workersRouter.post("/:id/verify-work-type", (0, _rbac.requirePermission)("worker.verify"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const profile = await _worker.WorkerService.verifyWorkType(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: profile
  };
  res.json(body);
}));
workersRouter.post("/:id/activate", (0, _rbac.requirePermission)("worker.verify"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const profile = await _worker.WorkerService.activate(req.params.id, req.auth.userId);
  const body = {
    success: true,
    data: profile
  };
  res.json(body);
}));
const rejectSchema = _zod.z.object({
  reason: _zod.z.string().trim().min(3).max(500)
});
workersRouter.post("/:id/reject", (0, _rbac.requirePermission)("worker.verify"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    reason
  } = rejectSchema.parse(req.body);
  const profile = await _worker.WorkerService.reject(req.params.id, reason, req.auth.userId);
  const body = {
    success: true,
    data: profile
  };
  res.json(body);
}));

// --- Site assignment / work type change ----------------------------------

const assignSiteSchema = _zod.z.object({
  siteId: _zod.z.string().min(1),
  reason: _zod.z.string().trim().max(300).optional()
});
workersRouter.post("/:id/assign-site", (0, _rbac.requirePermission)("worker.assignSite"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = assignSiteSchema.parse(req.body);
  const assignment = await _worker.WorkerService.assignSite({
    workerId: req.params.id,
    siteId: input.siteId,
    assignedBy: req.auth.userId,
    reason: input.reason
  });
  const body = {
    success: true,
    data: assignment
  };
  res.json(body);
}));
const changeWorkTypeSchema = _zod.z.object({
  workTypeId: _zod.z.string().min(1)
});
workersRouter.post("/:id/change-work-type", (0, _rbac.requirePermission)("worker.changeWorkType"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    workTypeId
  } = changeWorkTypeSchema.parse(req.body);
  const profile = await _worker.WorkerService.changeWorkType(req.params.id, workTypeId, req.auth.userId);
  const body = {
    success: true,
    data: profile
  };
  res.json(body);
}));