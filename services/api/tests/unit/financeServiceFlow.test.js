jest.mock("../../src/db/models/Finance", () => ({
  SiteCapital: { aggregate: jest.fn() },
  SiteInvestment: { create: jest.fn(), find: jest.fn(), aggregate: jest.fn(), countDocuments: jest.fn() },
  FinancialTransaction: { aggregate: jest.fn() },
  FINANCE_CATEGORIES: {
    INCOME: ["CLIENT_PAYMENT", "OTHER"],
    EXPENSE: ["MATERIAL", "OTHER"]
  },
  INVESTMENT_TYPES: ["CASH", "MATERIAL", "EQUIPMENT", "LABOUR_ADVANCE", "OTHER"]
}));
jest.mock("../../src/db/models/SalaryLedger", () => ({
  SalaryLedger: { aggregate: jest.fn(), find: jest.fn() }
}));
jest.mock("../../src/db/models/Site", () => ({
  Site: { findById: jest.fn(), find: jest.fn() }
}));
jest.mock("../../src/modules/auditLogs/audit.service", () => ({
  AuditService: { log: jest.fn() }
}));
jest.mock("../../src/sockets/gateway", () => ({
  getIO: jest.fn(() => ({ to: jest.fn().mockReturnThis(), emit: jest.fn() }))
}));

const { Site } = require("../../src/db/models/Site");
const Finance = require("../../src/db/models/Finance");
const { SalaryLedger } = require("../../src/db/models/SalaryLedger");
const { FinanceService } = require("../../src/modules/finance/finance.service");

const actorId = "507f1f77bcf86cd799439099";
const siteId = "507f1f77bcf86cd799439021";
const siteDoc = { _id: siteId, name: "Tower A", code: "PRJ01", status: "ACTIVE" };

beforeEach(() => {
  jest.clearAllMocks();
  Site.findById.mockResolvedValue(siteDoc);
});

describe("FinanceService.addInvestment (admin invests in a site)", () => {
  test("creates a SiteInvestment in paise, logs the audit event and broadcasts", async () => {
    Finance.SiteInvestment.create.mockResolvedValueOnce({
      _id: "inv1",
      site: siteId,
      amountPaise: 50_000_00,
      type: "CASH"
    });
    // The post-save P/L broadcast calls getSiteProfitLoss → stub its aggregates:
    Finance.FinancialTransaction.aggregate.mockResolvedValue([]);
    SalaryLedger.aggregate.mockResolvedValue([]);
    Finance.SiteInvestment.aggregate.mockResolvedValue([{ total: 50_000_00 }]);
    Finance.SiteInvestment.countDocuments.mockResolvedValue(1);
    Finance.SiteCapital.aggregate.mockResolvedValue([]);

    const investment = await FinanceService.addInvestment(
      { siteId, amountRupees: 50000, type: "CASH", date: "2026-09-20", note: "Cash for materials" },
      actorId
    );

    expect(Finance.SiteInvestment.create).toHaveBeenCalledWith(
      expect.objectContaining({ site: siteId, amountPaise: 50_000_00, type: "CASH", createdBy: actorId })
    );
    expect(investment.amountPaise).toBe(50_000_00);
  });

  test("unknown site → 404", async () => {
    Site.findById.mockResolvedValueOnce(null);
    await expect(
      FinanceService.addInvestment({ siteId: "nope", amountRupees: 100, date: "2026-09-20" }, actorId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("FinanceService.getSiteProfitLoss (with investments)", () => {
  test("income − expenses = profit/loss; investment yields net position", async () => {
    Finance.FinancialTransaction.aggregate
      .mockResolvedValueOnce([{ total: 8_00_000 }]) // income ₹8,000
      .mockResolvedValueOnce([{ total: 3_00_000 }]); // expenses ₹3,000
    SalaryLedger.aggregate.mockResolvedValueOnce([{ total: 1_50_000 }]); // labour ₹1,500
    Finance.SiteInvestment.aggregate.mockResolvedValueOnce([{ total: 10_00_000 }]); // invested ₹10,000
    Finance.SiteInvestment.countDocuments.mockResolvedValueOnce(2);
    Finance.SiteCapital.aggregate.mockResolvedValueOnce([]);

    const result = await FinanceService.getSiteProfitLoss(siteId);

    expect(result.income).toBe(8000);
    expect(result.totalExpenses).toBe(4500); // 3000 + 1500
    expect(result.investment).toBe(10000);
    expect(result.investmentCount).toBe(2);
    expect(result.profitLoss).toBe(3500); // 8000 − 4500
    expect(result.netPosition).toBe(-6500); // 3500 − 10000
  });

  test("site expenses include paid worker payouts from the salary ledger", async () => {
    Finance.FinancialTransaction.aggregate.mockResolvedValue([]);
    SalaryLedger.aggregate
      .mockResolvedValueOnce([]) // accrued labour
      .mockResolvedValueOnce([{ total: 1_25_000 }]); // ₹1,250 advance/Kharchi payout
    Finance.SiteInvestment.aggregate.mockResolvedValue([]);
    Finance.SiteInvestment.countDocuments.mockResolvedValueOnce(0);
    Finance.SiteCapital.aggregate.mockResolvedValue([]);

    const result = await FinanceService.getSiteProfitLoss(siteId);

    expect(result.workerPayouts).toBe(1250);
    expect(result.totalExpenses).toBe(1250);
  });

  test("reversed investments are subtracted from the total", async () => {
    Finance.FinancialTransaction.aggregate.mockResolvedValue([]);
    SalaryLedger.aggregate.mockResolvedValue([]);
    Finance.SiteInvestment.aggregate.mockResolvedValueOnce([{ total: 4_00_000 }]); // 5,000 in − 1,000 reversed
    Finance.SiteInvestment.countDocuments.mockResolvedValueOnce(1);
    Finance.SiteCapital.aggregate.mockResolvedValue([]);

    const result = await FinanceService.getSiteProfitLoss(siteId);
    expect(result.investment).toBe(4000);
  });
});

describe("FinanceService.getGrossSummary (per-site rows + company gross totals)", () => {
  test("merges transactions, labour and investments for every site and computes gross P/L", async () => {
    const siteA = { _id: siteId, name: "Tower A", code: "PRJ01", status: "ACTIVE" };
    const siteB = { _id: "507f1f77bcf86cd799439022", name: "Bridge B", code: "PRJ02", status: "COMPLETED" };
    Site.find.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([siteA, siteB])
    });
    Finance.FinancialTransaction.aggregate.mockResolvedValueOnce([
      { _id: { site: siteA._id, direction: "INCOME" }, total: 20_00_000 },
      { _id: { site: siteA._id, direction: "EXPENSE" }, total: 8_00_000 },
      { _id: { site: siteB._id, direction: "INCOME" }, total: 4_00_000 },
      { _id: { site: siteB._id, direction: "EXPENSE" }, total: 9_00_000 }
    ]);
    SalaryLedger.aggregate.mockResolvedValueOnce([
      { _id: siteA._id, total: 2_00_000 },
      { _id: siteB._id, total: 1_00_000 }
    ]);
    Finance.SiteInvestment.aggregate.mockResolvedValueOnce([
      { _id: siteA._id, total: 5_00_000 },
      { _id: siteB._id, total: 2_00_000 }
    ]);

    const summary = await FinanceService.getGrossSummary({});

    // Site A: income 20000 − (8000 + 2000) = +10000; net = 10000 − 5000 = 5000
    expect(summary.sites[0]).toMatchObject({
      siteId,
      siteName: "Tower A",
      investment: 5000,
      income: 20000,
      totalExpenses: 10000,
      profitLoss: 10000,
      netPosition: 5000
    });
    // Site B: income 4000 − (9000 + 1000) = −6000; net = −6000 − 2000 = −8000
    expect(summary.sites[1]).toMatchObject({
      siteName: "Bridge B",
      investment: 2000,
      income: 4000,
      totalExpenses: 10000,
      profitLoss: -6000,
      netPosition: -8000
    });

    const t = summary.totals;
    expect(t.siteCount).toBe(2);
    expect(t.totalInvestment).toBe(7000);
    expect(t.totalIncome).toBe(24000);
    expect(t.totalExpenses).toBe(20000);
    expect(t.grossProfit).toBe(10000);
    expect(t.grossLoss).toBe(6000);
    expect(t.grossProfitLoss).toBe(4000); // Σ site profit/loss
    expect(t.netPosition).toBe(-3000); // after recovering all investments
  });

  test("gross totals include advances/Kharchi on their related site", async () => {
    Site.find.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([siteDoc])
    });
    Finance.FinancialTransaction.aggregate.mockResolvedValueOnce([
      { _id: { site: siteId, direction: "INCOME" }, total: 10_00_000 },
      { _id: { site: siteId, direction: "EXPENSE" }, total: 2_00_000 }
    ]);
    SalaryLedger.aggregate
      .mockResolvedValueOnce([{ _id: siteId, total: 1_00_000 }]) // labour
      .mockResolvedValueOnce([{ _id: siteId, total: 3_00_000 }]); // worker payout
    Finance.SiteInvestment.aggregate.mockResolvedValueOnce([]);

    const summary = await FinanceService.getGrossSummary({});

    expect(summary.sites[0]).toMatchObject({
      workerPayouts: 3000,
      totalExpenses: 6000,
      profitLoss: 4000
    });
    expect(summary.totals).toMatchObject({
      totalWorkerPayouts: 3000,
      totalExpenses: 6000,
      grossProfitLoss: 4000
    });
  });
});
