Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.supportRouter = void 0;
var _express = require("express");
var _zod = require("zod");
var _support = require("./support.service");
var _authenticate = require("../../middleware/authenticate");
var _rbac = require("../../middleware/rbac");
var _errorHandler = require("../../middleware/errorHandler");
var _sharedTypes = require("@ananta/shared-types");
const supportRouter = exports.supportRouter = (0, _express.Router)();
supportRouter.use(_authenticate.authenticate);
const createTicketSchema = _zod.z.object({
  subject: _zod.z.string().trim().min(3).max(200),
  message: _zod.z.string().trim().min(1).max(2000)
});
supportRouter.post("/tickets", (0, _rbac.requirePermission)("support.chat"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const input = createTicketSchema.parse(req.body);
  const result = await _support.SupportService.createTicket({
    raisedBy: req.auth.userId,
    subject: input.subject,
    firstMessage: input.message
  });
  const body = {
    success: true,
    data: result
  };
  res.status(201).json(body);
}));
supportRouter.get("/tickets", (0, _rbac.requirePermission)("support.chat"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    role,
    userId
  } = req.auth;
  const raisedBy = role === "SUPER_ADMIN" ? undefined : userId;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const tickets = await _support.SupportService.listTickets({
    raisedBy,
    status
  });
  const body = {
    success: true,
    data: tickets
  };
  res.json(body);
}));
supportRouter.get("/tickets/:id/messages", (0, _rbac.requirePermission)("support.chat"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const messages = await _support.SupportService.getMessages(req.params.id);
  const body = {
    success: true,
    data: messages
  };
  res.json(body);
}));
const postMessageSchema = _zod.z.object({
  body: _zod.z.string().trim().min(1).max(2000)
});
supportRouter.post("/tickets/:id/messages", (0, _rbac.requirePermission)("support.chat"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    body: messageBody
  } = postMessageSchema.parse(req.body);
  const message = await _support.SupportService.postMessage(req.params.id, req.auth.userId, messageBody);
  const body = {
    success: true,
    data: message
  };
  res.status(201).json(body);
}));
const statusSchema = _zod.z.object({
  status: _zod.z.enum(_sharedTypes.SUPPORT_TICKET_STATUS)
});
supportRouter.patch("/tickets/:id/status", (0, _rbac.requirePermission)("support.chat"), (0, _errorHandler.asyncHandler)(async (req, res) => {
  const {
    status
  } = statusSchema.parse(req.body);
  const ticket = await _support.SupportService.setStatus(req.params.id, status, req.auth.userId);
  const body = {
    success: true,
    data: ticket
  };
  res.json(body);
}));