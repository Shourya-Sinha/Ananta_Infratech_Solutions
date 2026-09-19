Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SupportTicket = exports.ChatMessage = void 0;
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const supportTicketSchema = new _mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  raisedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: _sharedTypes.SUPPORT_TICKET_STATUS,
    default: "OPEN",
    index: true
  },
  assignedTo: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});
const SupportTicket = exports.SupportTicket = (0, _mongoose.model)("SupportTicket", supportTicketSchema);
const chatMessageSchema = new _mongoose.Schema({
  ticket: {
    type: _mongoose.Types.ObjectId,
    ref: "SupportTicket",
    required: true,
    index: true
  },
  sender: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  body: {
    type: String,
    required: true
  },
  attachments: [{
    fileId: String,
    url: String
  }],
  readBy: [{
    type: _mongoose.Types.ObjectId,
    ref: "User"
  }]
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});
const ChatMessage = exports.ChatMessage = (0, _mongoose.model)("ChatMessage", chatMessageSchema);