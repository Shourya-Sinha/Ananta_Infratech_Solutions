const { deriveSalaryRates, expectedMonthlyGrossPaise } = require("@ananta/utils");
const { parseReceiptText } = require("../../src/modules/payroll/receiptOcr");
const { computeSiteFinanceRow } = require("../../src/modules/finance/financeMath");

const rules = { fullDayHours: 8, workingDaysPerMonth: 26 };

describe("deriveSalaryRates (hourly ⇄ daily ⇄ monthly)", () => {
  test("per-hour set → daily and monthly derived", () => {
    const r = deriveSalaryRates({ salaryMode: "HOURLY", hourlyRatePaise: 10000 }, rules); // ₹100/hr
    expect(r.dailyRatePaise).toBe(80000); // ₹800/day
    expect(r.monthlySalaryPaise).toBe(80000 * 26);
    expect(r.hourlyRatePaise).toBe(10000);
  });
  test("monthly set → daily and per-hour derived", () => {
    const r = deriveSalaryRates({ salaryMode: "MONTHLY", monthlySalaryPaise: 2600000 }, rules); // ₹26,000/mo
    expect(r.dailyRatePaise).toBe(100000); // ₹1,000/day
    expect(r.hourlyRatePaise).toBe(12500); // ₹125/hr
    expect(expectedMonthlyGrossPaise(r)).toBe(2600000);
  });
  test("daily set → hourly and monthly derived", () => {
    const r = deriveSalaryRates({ salaryMode: "DAILY", dailyRatePaise: 50000 }, rules);
    expect(r.hourlyRatePaise).toBe(6250);
    expect(r.monthlySalaryPaise).toBe(50000 * 26);
  });
  test("no individual rate → work-type default applies", () => {
    const r = deriveSalaryRates({ fallbackDailyRatePaise: 60000 }, rules);
    expect(r.source).toBe("WORK_TYPE_DEFAULT");
    expect(r.dailyRatePaise).toBe(60000);
  });
  test("nothing set → zeros, caller must reject", () => {
    expect(deriveSalaryRates({}, rules).dailyRatePaise).toBe(0);
  });
});

describe("parseReceiptText (salary receipt OCR)", () => {
  test("extracts UPI amount, UTR, date and time", () => {
    const r = parseReceiptText("Payment Successful ₹12,500\nUPI Ref No: 412345678901\n12 Oct 2026 03:45 PM\nTo Worker");
    expect(r.amountPaise).toBe(1250000);
    expect(r.transactionId).toBe("412345678901");
    expect(r.time).toBe("15:45");
    expect(r.paidAt.toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(r.confidence).toBe(1);
  });
  test("extracts Rs. amount and DD/MM/YYYY date", () => {
    const r = parseReceiptText("Amount Paid Rs. 8,000 on 05/09/2026 via Bank Transfer UTR: HDFC123456789012");
    expect(r.amountPaise).toBe(800000);
    expect(r.paidAt.toISOString().slice(0, 10)).toBe("2026-09-05");
    expect(r.transactionId).toBe("HDFC123456789012");
  });
  test("empty text → nulls, zero confidence", () => {
    expect(parseReceiptText("")).toEqual({ amountPaise: null, transactionId: null, paidAt: null, time: null, confidence: 0 });
  });
});

describe("site finance does not double-count advance/Kharchi payouts", () => {
  test("payouts are part of labour cost, not an extra expense", () => {
    const row = computeSiteFinanceRow({
      incomePaise: 20000000, // ₹2,00,000 billed
      expensePaise: 3000000, // ₹30,000 other expenses
      labourPaise: 10000000, // ₹1,00,000 gross salary
      workerPayoutPaise: 2000000 // ₹20,000 advance+Kharchi already paid out of that salary
    });
    expect(row.totalExpensesPaise).toBe(13000000); // NOT 1,50,000
    expect(row.profitLossPaise).toBe(7000000);
    expect(row.workerPayoutPaise).toBe(2000000); // still reported
  });
});
