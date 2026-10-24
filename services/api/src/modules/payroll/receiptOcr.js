"use strict";

/**
 * Small OCR-text parser for salary payment receipts (UPI / bank screenshots).
 *
 * The image → text step is done by the client (phone OCR / admin typing the
 * text) or a future tesseract hook; THIS module is the deterministic part:
 * given raw OCR text it extracts { amount, date, time, transactionId } so
 * the admin only confirms instead of typing everything. Pure + unit-tested.
 *
 * Recognises the shapes Indian payment apps actually print:
 *   "₹12,500" / "Rs. 12500" / "INR 12,500.00" / "Amount Paid 12500"
 *   "12 Oct 2026" / "12/10/2026" / "2026-10-12" (+ optional "03:45 PM")
 *   UPI Ref / UTR / Transaction ID / Ref No: 12–22 digits or alphanumerics
 */

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseAmountPaise(text) {
  const labelled = text.match(/(?:amount(?:\s+paid)?|paid|total|salary)[^\d₹]{0,12}(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const currency = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const raw = (labelled && labelled[1]) || (currency && currency[1]);
  if (!raw) return null;
  const rupees = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(rupees) || rupees <= 0) return null;
  return Math.round(rupees * 100);
}

function parseTransactionId(text) {
  const labelled = text.match(/(?:upi\s*(?:ref|transaction)|utr|transaction\s*(?:id|no\.?|number)|txn\s*(?:id|no\.?)|ref(?:erence)?\s*(?:id|no\.?|number)|payment\s*id)[:\s#-]*([A-Za-z0-9]{8,30})/i);
  if (labelled) return labelled[1].toUpperCase();
  // Bare UTR: a standalone 12-digit (or longer) number is the standard shape.
  const bare = text.match(/\b(\d{12,22})\b/);
  return bare ? bare[1] : null;
}

function parseDateTime(text) {
  let date = null;
  let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/); // 2026-10-12
  if (m) date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!date) {
    m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](20\d{2})\b/); // 12/10/2026 (DMY, India)
    if (m) date = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  }
  if (!date) {
    m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/); // 12 Oct 2026
    if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
      date = new Date(Date.UTC(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]));
    }
  }
  let time = null;
  const t = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?\b/i);
  if (t) {
    let hh = +t[1];
    if (t[4] && t[4].toUpperCase() === "PM" && hh < 12) hh += 12;
    if (t[4] && t[4].toUpperCase() === "AM" && hh === 12) hh = 0;
    time = `${String(hh).padStart(2, "0")}:${t[2]}`;
    if (date) date.setUTCHours(hh, +t[2], t[3] ? +t[3] : 0, 0);
  }
  return { paidAt: date && !Number.isNaN(date.getTime()) ? date : null, time };
}

function parseReceiptText(rawText) {
  const text = String(rawText || "");
  if (!text.trim()) return { amountPaise: null, transactionId: null, paidAt: null, time: null, confidence: 0 };
  const amountPaise = parseAmountPaise(text);
  const transactionId = parseTransactionId(text);
  const { paidAt, time } = parseDateTime(text);
  const found = [amountPaise, transactionId, paidAt].filter(Boolean).length;
  return { amountPaise, transactionId, paidAt, time, confidence: Math.round((found / 3) * 100) / 100 };
}

module.exports = { parseReceiptText };
