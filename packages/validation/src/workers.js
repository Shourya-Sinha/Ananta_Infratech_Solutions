Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.workerRegisterSchema = exports.documentVerifySchema = void 0;
var _zod = require("zod");
var _auth = require("./auth");
// Super Admin "Add worker" (Admin Web): one-shot worker registration.
// Creates the WORKER User account and the WorkerProfile together, with an
// optional initial site assignment. password is optional — when omitted the
// API generates a random temporary password and returns it exactly once so
// the credentials can be handed to the worker in person.
const workerRegisterSchema = exports.workerRegisterSchema = _zod.z.object({
  name: _zod.z.string().trim().min(2).max(120),
  phone: _auth.phoneSchema,
  email: _zod.z.string().trim().email().optional(),
  workTypeId: _zod.z.string().min(1),
  siteId: _zod.z.string().min(1).optional(),
  password: _auth.passwordSchema.optional()
});
// Per-document verification decision (admin side, Registration Step 5 in
// granular form). A rejection must always carry a reason so the worker knows
// what to re-upload.
const documentVerifySchema = exports.documentVerifySchema = _zod.z.object({
  approve: _zod.z.boolean(),
  rejectionReason: _zod.z.string().trim().min(3).max(500).optional()
}).refine((data) => data.approve || (data.rejectionReason ?? "").length >= 3, {
  message: "A rejection reason (min 3 characters) is required when rejecting a document.",
  path: ["rejectionReason"]
});