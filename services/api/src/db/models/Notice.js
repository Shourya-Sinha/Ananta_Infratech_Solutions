"use strict";

const mongoose = require("mongoose");

/** Admin-published notice shown in the mobile app (home + Announcements). */
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    audience: { type: String, enum: ["ALL", "WORKERS", "MANAGERS"], default: "ALL", index: true },
    pinned: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);
exports.Announcement = mongoose.model("Announcement", announcementSchema);

/** Company holiday set by Admin. Shown on attendance calendars; purely informational (attendance rules unchanged). */
const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: Date, required: true, unique: true, index: true },
    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);
exports.Holiday = mongoose.model("Holiday", holidaySchema);

/**
 * Worker leave request. On approval, one attendance record per day is
 * created (LEAVE_PAID / LEAVE_UNPAID) through AttendanceService, so paid
 * leave flows into salary exactly like manager-marked paid leave.
 */
const leaveRequestSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Types.ObjectId, ref: "WorkerProfile", required: true, index: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    leaveType: { type: String, enum: ["PAID", "UNPAID"], default: "PAID" },
    reason: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED"], default: "REQUESTED", index: true },
    decidedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    decisionNote: { type: String, trim: true, maxlength: 500 },
    attendanceCreated: { type: Number, default: 0 }
  },
  { timestamps: true }
);
exports.LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);
