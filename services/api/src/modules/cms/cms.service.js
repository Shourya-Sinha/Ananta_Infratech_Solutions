"use strict";

const { SiteContent } = require("../../db/models/SiteContent");
const { WebsiteInquiry } = require("../../db/models/WebsiteInquiry");
const { AuditService } = require("../auditLogs/audit.service");
const { AppError } = require("../../errors/AppError");
const { validateContent, defaultContentCopy } = require("./cms.content");

const CONTENT_KEY = "main";

async function loadDoc() {
  let doc = await SiteContent.findOne({ key: CONTENT_KEY });
  if (!doc) {
    doc = await SiteContent.create({ key: CONTENT_KEY, draft: defaultContentCopy() });
  }
  return doc;
}

function withDefaults(stored) {
  // Top-level merge: if a section was added to the defaults after content was
  // published, the public site still gets it instead of rendering nothing.
  return { ...defaultContentCopy(), ...(stored || {}) };
}

const CmsService = {
  /** Public read: published content, falling back to the built-in defaults. */
  async getPublicSite() {
    const doc = await SiteContent.findOne({ key: CONTENT_KEY }).lean();
    if (doc?.published) {
      return { content: withDefaults(doc.published), source: "published", publishedAt: doc.publishedAt };
    }
    return { content: defaultContentCopy(), source: "default", publishedAt: null };
  },

  /** Admin read: draft + published + whether they differ. */
  async getEditorState() {
    const doc = await loadDoc();
    const draft = withDefaults(doc.draft);
    const published = doc.published ? withDefaults(doc.published) : null;
    return {
      draft,
      published,
      publishedAt: doc.publishedAt ?? null,
      updatedAt: doc.updatedAt,
      hasUnpublishedChanges: JSON.stringify(draft) !== JSON.stringify(published)
    };
  },

  async saveDraft(input, actor, meta = {}) {
    const content = validateContent(input);
    const doc = await loadDoc();
    doc.draft = content;
    doc.updatedBy = actor;
    await doc.save();
    await AuditService.log({
      actor,
      action: "CMS_DRAFT_SAVED",
      targetType: "SiteContent",
      targetId: doc._id.toString(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    return CmsService.getEditorState();
  },

  async publish(actor, meta = {}) {
    const doc = await loadDoc();
    if (!doc.draft) throw AppError.validation("There is no draft to publish");
    doc.published = validateContent(doc.draft);
    doc.publishedAt = new Date();
    doc.updatedBy = actor;
    await doc.save();
    await AuditService.log({
      actor,
      action: "CMS_PUBLISHED",
      targetType: "SiteContent",
      targetId: doc._id.toString(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    return CmsService.getEditorState();
  },

  async discardDraft(actor, meta = {}) {
    const doc = await loadDoc();
    doc.draft = doc.published ? JSON.parse(JSON.stringify(doc.published)) : defaultContentCopy();
    doc.updatedBy = actor;
    await doc.save();
    await AuditService.log({
      actor,
      action: "CMS_DRAFT_DISCARDED",
      targetType: "SiteContent",
      targetId: doc._id.toString(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    return CmsService.getEditorState();
  },

  async createInquiry(input) {
    const doc = await WebsiteInquiry.create(input);
    return { id: doc._id.toString() };
  },

  async listInquiries({ kind, status } = {}) {
    const filter = {};
    if (kind) filter.kind = kind;
    if (status) filter.status = status;
    return WebsiteInquiry.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  },

  async updateInquiryStatus(id, status, actor, meta = {}) {
    const doc = await WebsiteInquiry.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!doc) throw AppError.notFound("Enquiry not found");
    await AuditService.log({
      actor,
      action: "WEBSITE_INQUIRY_STATUS_CHANGED",
      targetType: "WebsiteInquiry",
      targetId: id,
      after: { status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    return doc;
  }
};

exports.CmsService = CmsService;
