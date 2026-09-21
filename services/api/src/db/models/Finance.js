Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SiteCapital = exports.FinancialTransaction = exports.CompanyExpense = exports.MaterialIssue = exports.Material = exports.Supplier = exports.Equipment = exports.EquipmentAssignment = exports.SiteDiary = exports.FINANCE_CATEGORIES = void 0;
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
// ---------------- COMPANY EXPENSES (office-level, non-site) -------------
const COMPANY_EXPENSE_CATEGORIES = ["OFFICE_RENT", "UTILITIES", "SALARIES_OFFICE", "TRAVEL", "MARKETING", "LEGAL", "ACCOUNTING", "INSURANCE", "MAINTENANCE", "OTHER"];
const companyExpenseSchema = new _mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: COMPANY_EXPENSE_CATEGORIES
  },
  amountPaise: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  description: { type: String },
  paidTo: { type: String },
  reference: { type: String },
  createdBy: { type: _mongoose.Types.ObjectId, ref: "User", required: true },
  reversalOf: { type: _mongoose.Types.ObjectId, ref: "CompanyExpense", default: null }
}, { timestamps: true });
companyExpenseSchema.index({ date: -1 });
const CompanyExpense = exports.CompanyExpense = (0, _mongoose.model)("CompanyExpense", companyExpenseSchema);

// ---------------- SUPPLIERS / VENDORS -------------------------------------
const supplierSchema = new _mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contactPerson: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  gstin: { type: String },
  category: { type: String, enum: ["MATERIAL", "EQUIPMENT", "LABOUR_CONTRACTOR", "TRANSPORT", "OTHER"], default: "MATERIAL" },
  notes: { type: String },
  createdBy: { type: _mongoose.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
const Supplier = exports.Supplier = (0, _mongoose.model)("Supplier", supplierSchema);

// ---------------- MATERIALS / INVENTORY ----------------------------------
const materialSchema = new _mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, uppercase: true, trim: true },
  unit: { type: String, required: true, default: "KG" }, // KG, BAG, PIECE, LITER, CUBIC_METER etc.
  category: { type: String }, // e.g. Cement, Steel, Sand, Aggregate, Brick, Tile, Plumbing, Electrical
  currentStock: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  lastPurchaseRatePaise: { type: Number, default: 0 },
  supplier: { type: _mongoose.Types.ObjectId, ref: "Supplier" },
  createdBy: { type: _mongoose.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
materialSchema.index({ name: 1 });
const Material = exports.Material = (0, _mongoose.model)("Material", materialSchema);

// ---------------- MATERIAL ISSUE to sites --------------------------------
const materialIssueSchema = new _mongoose.Schema({
  material: { type: _mongoose.Types.ObjectId, ref: "Material", required: true },
  site: { type: _mongoose.Types.ObjectId, ref: "Site", required: true, index: true },
  quantity: { type: Number, required: true, min: 0 },
  ratePaise: { type: Number, min: 0 },
  date: { type: Date, required: true },
  type: { type: String, enum: ["ISSUE", "RETURN"], default: "ISSUE", required: true },
  issuedTo: { type: String }, // worker or subcontractor name
  reference: { type: String }, // challan no, etc
  note: { type: String },
  createdBy: { type: _mongoose.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
const MaterialIssue = exports.MaterialIssue = (0, _mongoose.model)("MaterialIssue", materialIssueSchema);

// ---------------- EQUIPMENT / TOOLS -------------------------------------
const equipmentSchema = new _mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, uppercase: true, trim: true },
  category: { type: String }, // EXCAVATOR, MIXER, TOOL, VEHICLE, ELECTRICAL, SAFETY
  serialNumber: { type: String },
  purchaseDate: { type: Date },
  purchaseRatePaise: { type: Number, min: 0 },
  condition: { type: String, enum: ["NEW", "GOOD", "FAIR", "NEEDS_REPAIR", "DAMAGED"], default: "GOOD" },
  status: { type: String, enum: ["AVAILABLE", "ASSIGNED", "IN_REPAIR", "RETIRED"], default: "AVAILABLE", index: true },
  notes: { type: String },
  createdBy: { type: _mongoose.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
const Equipment = exports.Equipment = (0, _mongoose.model)("Equipment", equipmentSchema);

const equipmentAssignmentSchema = new _mongoose.Schema({
  equipment: { type: _mongoose.Types.ObjectId, ref: "Equipment", required: true },
  site: { type: _mongoose.Types.ObjectId, ref: "Site", required: true, index: true },
  assignedTo: { type: String }, // person name
  dateAssigned: { type: Date, required: true },
  dateReturned: { type: Date },
  conditionOut: { type: String, default: "GOOD" },
  conditionIn: { type: String },
  note: { type: String },
  assignedBy: { type: _mongoose.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
const EquipmentAssignment = exports.EquipmentAssignment = (0, _mongoose.model)("EquipmentAssignment", equipmentAssignmentSchema);

// ---------------- SITE DIARY / DAILY PROGRESS LOG -----------------------
const siteDiarySchema = new _mongoose.Schema({
  site: { type: _mongoose.Types.ObjectId, ref: "Site", required: true, index: true },
  date: { type: Date, required: true },
  weather: { type: String, enum: ["SUNNY", "CLOUDY", "RAINY", "STORM", "EXTREME_HEAT", "OTHER"], default: "SUNNY" },
  workDone: { type: String, required: true },
  workersPresent: { type: Number, default: 0 },
  materialsReceived: { type: String },
  issues: { type: String },
  nextDayPlan: { type: String },
  photos: [{ fileId: String, url: String, caption: String }],
  createdBy: { type: _mongoose.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: _mongoose.Types.ObjectId, ref: "User" }
}, { timestamps: true });
siteDiarySchema.index({ site: 1, date: -1 });
const SiteDiary = exports.SiteDiary = (0, _mongoose.model)("SiteDiary", siteDiarySchema);
