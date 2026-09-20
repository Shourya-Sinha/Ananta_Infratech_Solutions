const {
  computeSiteFinanceRow,
  computeGrossTotals
} = require("../../src/modules/finance/financeMath");

// Pure math behind the investment / profit-loss feature. All values in paise.
describe("computeSiteFinanceRow (per-site investment + profit/loss)", () => {
  test("profitable site: income covers expenses and part of the investment", () => {
    const row = computeSiteFinanceRow({
      investmentPaise: 1_00_00_000, // ₹1,00,000 invested
      incomePaise: 2_00_00_000, // ₹2,00,000 earned
      expensePaise: 50_00_000, // ₹50,000 material/other
      labourPaise: 25_00_000 // ₹25,000 labour
    });
    expect(row.totalExpensesPaise).toBe(75_00_000);
    expect(row.profitLossPaise).toBe(1_25_00_000); // income − totalExpenses
    expect(row.netPositionPaise).toBe(25_00_000); // profitLoss − investment
  });

  test("loss-making site: negative profit/loss, deeper negative net position", () => {
    const row = computeSiteFinanceRow({
      investmentPaise: 10_00_000,
      incomePaise: 5_00_000,
      expensePaise: 8_00_000,
      labourPaise: 4_00_000
    });
    expect(row.totalExpensesPaise).toBe(12_00_000);
    expect(row.profitLossPaise).toBe(-7_00_000);
    expect(row.netPositionPaise).toBe(-17_00_000);
  });

  test("defaults missing partials to zero", () => {
    const row = computeSiteFinanceRow({ incomePaise: 10_00_000 });
    expect(row.investmentPaise).toBe(0);
    expect(row.expensePaise).toBe(0);
    expect(row.labourPaise).toBe(0);
    expect(row.totalExpensesPaise).toBe(0);
    expect(row.profitLossPaise).toBe(10_00_000);
    expect(row.netPositionPaise).toBe(10_00_000);
  });

  test("breakeven site: zero profit/loss and negative net position by exactly the investment", () => {
    const row = computeSiteFinanceRow({
      investmentPaise: 5_00_000,
      incomePaise: 6_00_000,
      expensePaise: 2_00_000,
      labourPaise: 4_00_000
    });
    expect(row.profitLossPaise).toBe(0);
    expect(row.netPositionPaise).toBe(-5_00_000);
  });
});

describe("computeGrossTotals (company gross profit/loss across sites)", () => {
  test("sums mixed profit and loss sites into gross profit / gross loss / gross P/L", () => {
    const a = computeSiteFinanceRow({ incomePaise: 20_00_000, expensePaise: 10_00_000 }); // +10
    const b = computeSiteFinanceRow({ incomePaise: 4_00_000, expensePaise: 9_00_000 }); // −5
    const c = computeSiteFinanceRow({ incomePaise: 0, expensePaise: 0 }); // 0
    const t = computeGrossTotals([a, b, c]);
    expect(t.grossProfitPaise).toBe(10_00_000);
    expect(t.grossLossPaise).toBe(5_00_000);
    expect(t.grossProfitLossPaise).toBe(5_00_000);
    expect(t.incomePaise).toBe(24_00_000);
    expect(t.totalExpensesPaise).toBe(19_00_000);
    expect(t.netPositionPaise).toBe(5_00_000);
  });

  test("investment reduces the company net position but not the gross profit/loss", () => {
    const a = computeSiteFinanceRow({
      investmentPaise: 50_00_000,
      incomePaise: 60_00_000,
      expensePaise: 10_00_000
    });
    const t = computeGrossTotals([a]);
    expect(t.grossProfitLossPaise).toBe(50_00_000); // income − expenses
    expect(t.investmentPaise).toBe(50_00_000);
    expect(t.netPositionPaise).toBe(0); // income − expenses − investment
  });

  test("empty site list yields all zeros", () => {
    const t = computeGrossTotals([]);
    expect(t.grossProfitPaise).toBe(0);
    expect(t.grossLossPaise).toBe(0);
    expect(t.grossProfitLossPaise).toBe(0);
    expect(t.netPositionPaise).toBe(0);
  });
});
