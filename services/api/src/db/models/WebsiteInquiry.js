"use strict";

// Submissions from the public website: contact form, and the careers
// "notify me" interest forms for contractors and workers (registration is
// launching soon, so these are waitlist entries until the app opens).
const mongoose = require("mongoose");

const WEBSITE_INQUIRY_KINDS = ["CONTACT", "CAREER_CONTRACTOR", "CAREER_WORKER"];
const WEBSITE_INQUIRY_STATUSES = ["NEW", "CONTACTED", "CLOSED"];

const websiteInquirySchema = new mongoose.Schema(
  {
    kind: { type: String, enum: WEBSITE_INQUIRY_KINDS, required: true, index: true },
    status: { type: String, enum: WEBSITE_INQUIRY_STATUSES, default: "NEW", index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 160 },
    trade: { type: String, trim: true, maxlength: 120 },
    experienceYears: { type: Number, min: 0, max: 60 },
    service: { type: String, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 2000 }
  },
  { timestamps: true }
);

exports.WebsiteInquiry = mongoose.model("WebsiteInquiry", websiteInquirySchema);
exports.WEBSITE_INQUIRY_KINDS = WEBSITE_INQUIRY_KINDS;
exports.WEBSITE_INQUIRY_STATUSES = WEBSITE_INQUIRY_STATUSES;
