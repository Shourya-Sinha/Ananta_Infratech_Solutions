Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SiteCapital = exports.FinancialTransaction = exports.FINANCE_CATEGORIES = void 0;
var _mongoose = require("mongoose");
var _sharedTypes = require("@ananta/shared-types");
const siteCapitalSchema = new _mongoose.Schema({
  site: {
    type: _mongoose.Types.ObjectId,
    ref: "Site",
    required: true,
    index: true
  },
  amountPaise: {
    type: Number,
    required: true,
    min: 0
  },
  source: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  reference: {
    type: String
  },
  createdBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});
const SiteCapital = exports.SiteCapital = (0, _mongoose.model)("SiteCapital", siteCapitalSchema);

// ADMIN INVESTMENT — money/material the admin puts INTO a project (site).
// Distinct from FinancialTransaction INCOME (money the project EARNS from
// clients) and from SiteCapital (raw funding pot): an investment is an
// admin-owned contribution used to compute each site's total investment,
// its profit/loss, and the company-wide gross profit/loss.
const INVESTMENT_TYPES = exports.INVESTMENT_TYPES = ["CASH", "MATERIAL", "EQUIPMENT", "LABOUR_ADVANCE", "OTHER"];
const siteInvestmentSchema = new _mongoose.Schema({
  site: {
    type: _mongoose.Types.ObjectId,
    ref: "Site",
    required: true,
    index: true
  },
  amountPaise: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: INVESTMENT_TYPES,
    default: "CASH"
  },
  date: {
    type: Date,
    required: true
  },
  reference: {
    type: String
  },
  note: {
    type: String
  },
  createdBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  reversalOf: {
    type: _mongoose.Types.ObjectId,
    ref: "SiteInvestment",
    default: null
  }
}, {
  timestamps: true
});
siteInvestmentSchema.index({
  site: 1,
  date: 1
});
const SiteInvestment = exports.SiteInvestment = (0, _mongoose.model)("SiteInvestment", siteInvestmentSchema);
const INCOME_CATEGORIES = ["CLIENT_PAYMENT", "CONTRACT_PAYMENT", "MILESTONE_PAYMENT", "OTHER"];
const EXPENSE_CATEGORIES = ["MATERIAL", "LABOUR", "TRANSPORT", "EQUIPMENT", "ELECTRICITY", "RENT", "FOOD", "MAINTENANCE", "VENDOR_PAYMENT", "OTHER"];
const FINANCE_CATEGORIES = exports.FINANCE_CATEGORIES = {
  INCOME: INCOME_CATEGORIES,
  EXPENSE: EXPENSE_CATEGORIES
};
const financialTransactionSchema = new _mongoose.Schema({
  site: {
    type: _mongoose.Types.ObjectId,
    ref: "Site",
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: _sharedTypes.TRANSACTION_DIRECTION,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true
  },
  amountPaise: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String
  },
  attachment: {
    fileId: String,
    url: String
  },
  createdBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User",
    required: true
  },
  approvedBy: {
    type: _mongoose.Types.ObjectId,
    ref: "User"
  },
  reversalOf: {
    type: _mongoose.Types.ObjectId,
    ref: "FinancialTransaction",
    default: null
  }
}, {
  timestamps: true
});
financialTransactionSchema.index({
  site: 1,
  direction: 1,
  date: 1
});
const FinancialTransaction = exports.FinancialTransaction = (0, _mongoose.model)("FinancialTransaction", financialTransactionSchema);