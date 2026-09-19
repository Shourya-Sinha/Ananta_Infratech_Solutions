Object.defineProperty(exports, "__esModule", {
  value: true
});
var _imagekit = require("../../config/imagekit");
var _Document = require("../../db/models/Document");
var _AppError = require("../../errors/AppError");
var _audit = require("../auditLogs/audit.service");
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

exports.DocumentService = {
  /**
   * Backend validates the file and performs the ImageKit upload itself —
   * the frontend never gets ImageKit private credentials, and never gets to
   * choose the stored URL directly (§29, §32 of spec).
   */
  async uploadAndRecord(params) {
    if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
      throw _AppError.AppError.validation(`Unsupported file type: ${params.mimeType}`);
    }
    if (params.fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      throw _AppError.AppError.validation("File exceeds the 8MB upload limit.");
    }
    const uploadResult = await _imagekit.imagekit.upload({
      file: params.fileBuffer,
      fileName: `${params.type}_${params.owner}_${Date.now()}_${params.fileName}`,
      folder: `/ananta-infratech/${params.type.toLowerCase()}`,
      useUniqueFileName: true
    });
    const doc = await _Document.DocumentModel.create({
      owner: params.owner,
      type: params.type,
      imagekitFileId: uploadResult.fileId,
      url: uploadResult.url,
      uploadedBy: params.uploadedBy,
      verificationStatus: "PENDING",
      metadata: {
        mimeType: params.mimeType,
        sizeBytes: params.fileBuffer.byteLength
      }
    });
    await _audit.AuditService.log({
      actor: params.uploadedBy,
      action: "DOCUMENT_UPLOADED",
      targetType: "Document",
      targetId: doc._id.toString(),
      after: {
        type: params.type,
        owner: params.owner
      }
    });
    return doc;
  },
  async verify(documentId, verifiedBy, approve, rejectionReason) {
    const doc = await _Document.DocumentModel.findById(documentId);
    if (!doc) throw _AppError.AppError.notFound("Document not found");
    doc.verificationStatus = approve ? "VERIFIED" : "REJECTED";
    doc.verifiedBy = verifiedBy;
    doc.verifiedAt = new Date();
    if (!approve) doc.rejectionReason = rejectionReason;
    await doc.save();
    await _audit.AuditService.log({
      actor: verifiedBy,
      action: approve ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
      targetType: "Document",
      targetId: doc._id.toString()
    });
    return doc;
  },
  async listForOwner(ownerId) {
    return _Document.DocumentModel.find({
      owner: ownerId
    }).sort({
      createdAt: -1
    });
  }
};