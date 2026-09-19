Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addPaise = addPaise;
exports.formatINR = formatINR;
exports.multiplyPaiseByFactor = multiplyPaiseByFactor;
exports.paiseToRupees = paiseToRupees;
exports.rupeesToPaise = rupeesToPaise;
exports.subtractPaise = subtractPaise;
/**
 * All money in this system is represented as an INTEGER number of paise.
 * Never do money math with raw JS floats. These helpers are the only
 * sanctioned way to convert or combine money values.
 */

// integer, always >= 0 for stored amounts unless explicitly a debit

function rupeesToPaise(rupees) {
  if (!Number.isFinite(rupees)) throw new Error("rupeesToPaise: not a finite number");
  // round to nearest paise to kill any float noise before converting to integer
  return Math.round(rupees * 100);
}
function paiseToRupees(paise) {
  assertInteger(paise, "paiseToRupees");
  return paise / 100;
}
function formatINR(paise) {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(rupees);
}
function addPaise(...values) {
  values.forEach(v => assertInteger(v, "addPaise"));
  return values.reduce((sum, v) => sum + v, 0);
}
function subtractPaise(a, b) {
  assertInteger(a, "subtractPaise");
  assertInteger(b, "subtractPaise");
  return a - b;
}

/**
 * Multiply a paise amount by a plain-number factor (e.g. hours, a rate multiplier)
 * and round deterministically to the nearest paise. This is the ONLY place
 * fractional math is allowed to touch money, and it always collapses back to an integer.
 */
function multiplyPaiseByFactor(paise, factor) {
  assertInteger(paise, "multiplyPaiseByFactor");
  if (!Number.isFinite(factor) || factor < 0) {
    throw new Error("multiplyPaiseByFactor: factor must be a finite, non-negative number");
  }
  return Math.round(paise * factor);
}
function assertInteger(value, fnName) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${fnName}: expected an integer paise value, got ${value}`);
  }
}