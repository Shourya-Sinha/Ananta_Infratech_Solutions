"use strict";

const mongoose = require("mongoose");

/**
 * Proof that a month's salary was actually sent to a worker (UPI screenshot
 * or bank receipt uploaded by the admin when marking salary paid).
 * OCR-extracted fields are stored alongside what the admin confirmed, plus
 * the raw OCR text, so a dispute can always be re-checked against the image.
 */
const salaryPaymentReceiptSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Types.ObjectId, ref: "WorkerProfile", required: true, index: true },
    payroll: { type: mongoose.Types.ObjectId, ref: "MonthlyPayroll", index: true },
    month: { type: String, required: true, index: true }, // "YYYY-MM"
    amountPaise: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["UPI", "BANK_TRANSFER", "CASH", "CHEQUE", "OTHER"], default: "UPI" },
    transactionId: { type: String, trim: true, index: true }, // UPI ref / UTR
    paidAt: { type: Date },
    // Uploaded image (via DocumentService → ImageKit) + link to its Document.
    document: { type: mongoose.Types.ObjectId, ref: "Document" },
    receiptUrl: { type: String },
    ocr: {
      rawText: { type: String },
      amountPaise: { type: Number },
      transactionId: { type: String },
      paidAt: { type: Date },
      time: { type: String },
      confidence: { type: Number }
    },
    note: { type: String, trim: true, maxlength: 500 },
    uploadedBy: { type: mongoose.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

salaryPaymentReceiptSchema.index({ worker: 1, month: 1 });

exports.SalaryPaymentReceipt = mongoose.model("SalaryPaymentReceipt", salaryPaymentReceiptSchema);
