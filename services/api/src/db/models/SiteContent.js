"use strict";

// Public website content. A single document (key "main") holds two copies:
//   draft     — what the CMS editor is working on (shown only in preview)
//   published — what the public website serves
// Publishing copies draft → published. Discarding copies published → draft.
const mongoose = require("mongoose");

const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    draft: { type: mongoose.Schema.Types.Mixed },
    published: { type: mongoose.Schema.Types.Mixed },
    publishedAt: { type: Date },
    updatedBy: { type: String }
  },
  { timestamps: true }
);

exports.SiteContent = mongoose.model("SiteContent", siteContentSchema);
