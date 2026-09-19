Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SUBUNITS_PER_UNIT = exports.DEFAULT_SALARY_RULES = exports.CURRENCY_SUBUNIT = void 0;
// Default SalaryRule seed values. All are re-readable/writable at runtime from
// SystemSetting/SalaryRule collections — these are just the seeded defaults,
// never hardcoded into calculation logic directly.

const DEFAULT_SALARY_RULES = exports.DEFAULT_SALARY_RULES = {
  FULL_DAY_HOURS: 8,
  HALF_DAY_HOURS: 4,
  OVERTIME_START_HOURS: 8,
  // hours beyond this are overtime
  OVERTIME_MULTIPLIER: 1.0,
  // 1.0 = paid at straight hourly rate; admin can raise to 1.5 etc.
  ROUNDING_POLICY: "NEAREST_PAISE" // NEAREST_PAISE | ROUND_UP | ROUND_DOWN
};
const CURRENCY_SUBUNIT = exports.CURRENCY_SUBUNIT = "paise";
const SUBUNITS_PER_UNIT = exports.SUBUNITS_PER_UNIT = 100; // 1 INR = 100 paise