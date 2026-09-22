const {
  formatExportRs,
  exportPeriodError,
  normalizeExportFormat,
  buildFinancialExport,
  renderFinancialExport
} = require("../../src/modules/finance/financeExport");
const { computeGrossTotals } = require("../../src/modules/finance/financeMath");

const SITES = [
  { id: "site-a", name: "Alpha Yard", code: "ALP", status: "ACTIVE" },
  { id: "site-b", name: "Beta Bridge", code: "BET", status: "PLANNING" }
];

const WORKERS = [
  { id: "w1", employeeId: "EMP-1", name: "O'Brien & Sons" },
  { id: "w2", employeeId: "EMP-2", name: "राम Kumar" }
];

function sampleInput(extra = {}) {
  return {
    generatedAt: "2026-09-22T10:15:00.000Z",
    period: { from: null, to: null },
    sites: SITES,
    workers: WORKERS,
    transactions: [
      { siteId: "site-a", direction: "INCOME", category: "CLIENT_PAYMENT", amountPaise: 5_00_000, date: "2026-09-01", description: "Milestone (phase 1)" },
      { siteId: "site-a", direction: "EXPENSE", category: "MATERIAL", amountPaise: 40_000, date: "2026-09-02", description: "Cement" },
      // A reversed income is stored as an opposite EXPENSE, same as the Finance page.
      { siteId: "site-a", direction: "EXPENSE", category: "OTHER", amountPaise: 10_000, date: "2026-09-03", description: "Reversal", reversalOf: "tx-1" },
      { siteId: "site-b", direction: "INCOME", category: "OTHER", amountPaise: 0, date: "2026-09-04", description: "Zero skipped? no, zero still a line" }
    ],
    investments: [
      { siteId: "site-a", type: "CASH", amountPaise: 1_00_000, date: "2026-08-01", reference: "NEFT", note: "Opening" },
      { siteId: "site-a", type: "CASH", amountPaise: 20_000, date: "2026-08-15", reversalOf: "inv-1", note: "Partial reversal" },
      { siteId: "site-b", type: "MATERIAL", amountPaise: 50_000, date: "2026-08-20", note: "Steel" }
    ],
    ledger: [
      { workerId: "w1", siteId: "site-a", type: "EARNING", creditPaise: "80000", debitPaise: "0", date: "2026-09-05", description: "Day wage" },
      { workerId: "w1", siteId: "site-a", type: "ADVANCE_DEDUCTION", creditPaise: "0", debitPaise: "20000", date: "2026-09-06", description: "Advance" },
      { workerId: "w1", siteId: "site-b", type: "KHARCHI_DEDUCTION", creditPaise: "0", debitPaise: "5000", date: "2026-09-07", description: "Kharchi" },
      { workerId: "w2", siteId: "site-a", type: "OVERTIME", creditPaise: "30000", debitPaise: "0", date: "2026-09-08", description: "Overtime" },
      { workerId: "w2", siteId: "site-a", type: "REVERSAL", creditPaise: "0", debitPaise: "30000", date: "2026-09-09", description: "Attendance deleted" },
      { workerId: "w1", siteId: "missing-site", type: "EARNING", creditPaise: "99900", debitPaise: "0", date: "2026-09-10", description: "Orphan wage" }
    ],
    ...extra
  };
}

describe("formatExportRs", () => {
  test("groups rupees the Indian way and keeps paise", () => {
    expect(formatExportRs(0)).toBe("Rs 0.00");
    expect(formatExportRs(100)).toBe("Rs 1.00");
    expect(formatExportRs(1_00_000)).toBe("Rs 1,000.00");
    expect(formatExportRs(1_00_00_000)).toBe("Rs 1,00,000.00");
    expect(formatExportRs(12_34_56_789_00)).toBe("Rs 12,34,56,789.00");
    expect(formatExportRs(-250)).toBe("Rs -2.50");
  });
});

describe("export format and period", () => {
  test("accepts the three admin choices and the common aliases", () => {
    expect(normalizeExportFormat("pdf")).toBe("pdf");
    expect(normalizeExportFormat("DOC")).toBe("doc");
    expect(normalizeExportFormat("docx")).toBe("doc");
    expect(normalizeExportFormat("xls")).toBe("xls");
    expect(normalizeExportFormat("xlsx")).toBe("xls");
    expect(normalizeExportFormat("csv")).toBeNull();
  });

  test("rejects a start date after the end date", () => {
    expect(exportPeriodError({ from: "2026-09-10", to: "2026-09-01" })).toMatch(/start date/);
    expect(exportPeriodError({ from: "2026-09-01", to: "2026-09-10" })).toBeNull();
  });
});

describe("buildFinancialExport", () => {
  test("keeps worker, site and gross figures separated and aligned with financeMath", () => {
    const report = buildFinancialExport(sampleInput());

    const w1 = report.workers.find((worker) => worker.employeeId === "EMP-1");
    const w2 = report.workers.find((worker) => worker.employeeId === "EMP-2");
    expect(w1.labourPaise).toBe(80_000);
    expect(w1.advancePaise).toBe(20_000);
    expect(w1.kharchiPaise).toBe(5_000);
    expect(w1.totalPaise).toBe(1_05_000);
    expect(w1.siteNames).toBe("Alpha Yard, Beta Bridge");
    // Overtime is counted. The attendance reversal is not, so it does not reduce the total.
    expect(w2.totalPaise).toBe(30_000);
    expect(report.corrections).toHaveLength(1);
    expect(report.corrections[0].kind).toBe("Attendance reversal");

    const alpha = report.sites.find((site) => site.siteCode === "ALP");
    const beta = report.sites.find((site) => site.siteCode === "BET");
    expect(alpha.workerExpensesPaise).toBe(1_30_000);
    expect(alpha.incomePaise).toBe(5_00_000);
    expect(alpha.investmentPaise).toBe(80_000);
    expect(alpha.materialPaise).toBe(50_000);
    expect(alpha.workers.map((worker) => worker.employeeId).sort()).toEqual(["EMP-1", "EMP-2"]);
    expect(beta.workerExpensesPaise).toBe(5_000);
    expect(beta.incomePaise).toBe(0);
    expect(beta.investmentPaise).toBe(50_000);
    expect(beta.workers).toHaveLength(1);

    expect(report.totals.workerExpensesPaise).toBe(1_35_000);
    expect(report.totals.investmentPaise).toBe(1_30_000);
    expect(report.totals.incomePaise).toBe(5_00_000);
    expect(report.totals.materialPaise).toBe(50_000);
    expect(report.totals.totalExpensesPaise).toBe(1_85_000);
    expect(report.totals.grossProfitLossPaise).toBe(3_15_000);
    expect(report.totals.netPositionPaise).toBe(1_85_000);

    const gross = computeGrossTotals(report.sites.map((site) => site.finance));
    expect(report.totals.grossProfitLossPaise).toBe(gross.grossProfitLossPaise);
    expect(report.totals.incomePaise).toBe(gross.incomePaise);
    expect(report.totals.investmentPaise).toBe(gross.investmentPaise);

    expect(report.unlinked.workerExpensesPaise).toBe(99_900);
    expect(report.unlinked.lines[0].description).toContain("EMP-1");
    expect(report.incomeLines.some((line) => line.category === "CLIENT PAYMENT")).toBe(true);
    expect(report.incomeLines.some((line) => line.description.includes("(phase 1)"))).toBe(true);
  });

  test("an empty company still has every site section and zero gross", () => {
    const report = buildFinancialExport({
      generatedAt: "2026-09-22T00:00:00.000Z",
      sites: SITES,
      workers: [],
      transactions: [],
      investments: [],
      ledger: []
    });
    expect(report.sites).toHaveLength(2);
    expect(report.sites.every((site) => site.workerExpensesPaise === 0 && site.incomePaise === 0 && site.investmentPaise === 0)).toBe(true);
    expect(report.totals.grossProfitLossPaise).toBe(0);
    expect(report.workers).toHaveLength(0);
    expect(report.unlinked).toBeNull();
    expect(report.periodLabel).toBe("All dates");
  });

  test("caps the line list without dropping the totals", () => {
    const report = buildFinancialExport(sampleInput({ lineCap: 1 }));
    expect(report.workerLines).toHaveLength(1);
    expect(report.workerLinesTruncated).toBe(true);
    expect(report.workerLineCount).toBe(4);
    expect(report.totals.workerExpensesPaise).toBe(1_35_000);
  });
});

describe("renderFinancialExport", () => {
  const report = buildFinancialExport(sampleInput());
  const titles = [
    "1. Separate worker expenses",
    "2. Total worker expenses",
    "3. Total investment",
    "4. Total income",
    "5. Each site - worker expenses, income and investment",
    "6. Gross"
  ];

  test("PDF, Word and Excel are one file each and keep the sections apart", () => {
    const pdf = renderFinancialExport(report, "pdf");
    const doc = renderFinancialExport(report, "word");
    const xls = renderFinancialExport(report, "excel");

    expect(pdf.filename.endsWith(".pdf")).toBe(true);
    expect(doc.filename.endsWith(".doc")).toBe(true);
    expect(xls.filename.endsWith(".xls")).toBe(true);
    expect(pdf.contentType).toBe("application/pdf");
    expect(doc.contentType).toBe("application/msword");
    expect(xls.contentType).toBe("application/vnd.ms-excel");

    assertPdf(pdf.buffer);
    const pdfText = pdf.buffer.toString("latin1");
    for (const title of titles) expect(pdfText).toContain(title);
    expect(pdfText).toContain("O'Brien & Sons");
    expect(pdfText).toContain("Rs 1,350.00");

    const docText = doc.buffer.toString("utf8");
    expect(docText).toContain("<html");
    for (const title of titles) expect(docText).toContain(title);
    expect(docText).toContain("O'Brien &amp; Sons");
    expect(docText).toContain("राम");
    expect(docText).toContain("page-break-before: always");

    const xlsText = xls.buffer.toString("utf8");
    expect(xlsText).toContain("<?xml");
    expect(xlsText).toContain("ss:Name=\"Worker expenses\"");
    expect(xlsText).toContain("ss:Name=\"Total worker expenses\"");
    expect(xlsText).toContain("ss:Name=\"Total investment\"");
    expect(xlsText).toContain("ss:Name=\"Total income\"");
    expect(xlsText).toContain("ss:Name=\"Sites\"");
    expect(xlsText).toContain("ss:Name=\"Site workers\"");
    expect(xlsText).toContain("ss:Name=\"Gross\"");
    expect(xlsText).toContain("O&apos;Brien &amp; Sons");
    expect(xlsText).toContain("राम");
    expect(xlsText).toContain(">5000.00<");
    expect(xlsText).toContain(">1350.00<");
  });

  test("an empty export still names every section", () => {
    const empty = buildFinancialExport({
      generatedAt: "2026-09-22T00:00:00.000Z",
      sites: [],
      workers: [],
      transactions: [],
      investments: [],
      ledger: []
    });
    const pdf = renderFinancialExport(empty, "pdf");
    assertPdf(pdf.buffer);
    const text = pdf.buffer.toString("latin1");
    for (const title of titles) expect(text).toContain(title);
    expect(text).toContain("None in this period.");
  });
});

function assertPdf(buffer) {
  const text = buffer.toString("latin1");
  expect(text.startsWith("%PDF-1.4")).toBe(true);
  expect(text.includes("%%EOF")).toBe(true);
  const start = text.lastIndexOf("startxref");
  const offset = Number(text.slice(start).match(/startxref\s+(\d+)/)[1]);
  expect(text.slice(offset, offset + 4)).toBe("xref");
  const trailer = text.slice(text.lastIndexOf("trailer"), start);
  const size = Number(trailer.match(/\/Size\s+(\d+)/)[1]);
  const lines = text.slice(offset, start).split("\n").filter((line) => /^\d{10} \d{5} [nf] $/.test(line));
  expect(lines.length).toBe(size);
  lines.forEach((line, index) => {
    if (index === 0) return;
    const at = Number(line.slice(0, 10));
    expect(text.slice(at, at + 12).startsWith(`${index} 0 obj`)).toBe(true);
  });
  const streamRe = /<< \/Length (\d+) >>\nstream\n/g;
  let match;
  let streams = 0;
  while ((match = streamRe.exec(text))) {
    streams += 1;
    const length = Number(match[1]);
    const dataStart = match.index + match[0].length;
    expect(text.slice(dataStart + length, dataStart + length + 10)).toBe("\nendstream");
  }
  expect(streams).toBeGreaterThan(0);
}
