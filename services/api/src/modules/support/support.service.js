Object.defineProperty(exports, "__esModule", {
  value: true
});
var _Support = require("../../db/models/Support");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
var _gateway = require("../../sockets/gateway");
var _sharedTypes = require("@ananta/shared-types");
async function nextTicketNumber() {
  const count = await _Support.SupportTicket.countDocuments();
  return `SUPPORT-${1000 + count + 1}`;
}
exports.SupportService = {
  async createTicket(input) {
    const ticketNumber = await nextTicketNumber();
    const ticket = await _Support.SupportTicket.create({
      ticketNumber,
      raisedBy: input.raisedBy,
      subject: input.subject,
      status: "OPEN"
    });
    const message = await _Support.ChatMessage.create({
      ticket: ticket._id,
      sender: input.raisedBy,
      body: input.firstMessage,
      readBy: [input.raisedBy]
    });
    await _audit.AuditService.log({
      actor: input.raisedBy,
      action: "SUPPORT_TICKET_CREATED",
      targetType: "SupportTicket",
      targetId: ticket._id.toString(),
      after: {
        subject: input.subject
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).emit(_sharedTypes.SOCKET_EVENTS.CHAT_MESSAGE, {
      ticketId: ticket._id.toString(),
      messageId: message._id.toString()
    });
    return {
      ticket,
      message
    };
  },
  async listTickets(filter) {
    const query = {};
    if (filter.raisedBy) query.raisedBy = filter.raisedBy;
    if (filter.status) query.status = filter.status;
    if (filter.assignedTo) query.assignedTo = filter.assignedTo;
    return _Support.SupportTicket.find(query).populate("raisedBy", "name phone").sort({
      createdAt: -1
    });
  },
  async postMessage(ticketId, senderId, body) {
    const ticket = await _Support.SupportTicket.findById(ticketId);
    if (!ticket) throw _AppError.AppError.notFound("Support ticket not found");
    if (ticket.status === "CLOSED") throw _AppError.AppError.conflict("Cannot post to a closed ticket. Reopen it first.");
    const message = await _Support.ChatMessage.create({
      ticket: ticket._id,
      sender: senderId,
      body,
      readBy: [senderId]
    });
    if (ticket.status === "OPEN") {
      ticket.status = "IN_PROGRESS";
      await ticket.save();
    }
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.user(ticket.raisedBy.toString())).emit(_sharedTypes.SOCKET_EVENTS.CHAT_MESSAGE, {
      ticketId: ticket._id.toString(),
      messageId: message._id.toString()
    });
    return message;
  },
  async getMessages(ticketId) {
    return _Support.ChatMessage.find({
      ticket: ticketId
    }).populate("sender", "name role").sort({
      createdAt: 1
    });
  },
  async setStatus(ticketId, status, actorId) {
    const ticket = await _Support.SupportTicket.findById(ticketId);
    if (!ticket) throw _AppError.AppError.notFound("Support ticket not found");
    const before = {
      status: ticket.status
    };
    ticket.status = status;
    await ticket.save();
    await _audit.AuditService.log({
      actor: actorId,
      action: "SUPPORT_TICKET_STATUS_CHANGED",
      targetType: "SupportTicket",
      targetId: ticket._id.toString(),
      before,
      after: {
        status
      }
    });
    (0, _gateway.getIO)().to(_sharedTypes.ROOMS.admin()).to(_sharedTypes.ROOMS.user(ticket.raisedBy.toString())).emit(_sharedTypes.SOCKET_EVENTS.CHAT_READ, {
      ticketId: ticket._id.toString(),
      status
    });
    return ticket;
  }
};