"use strict";

const { computeSiteFinanceRow, computeGrossTotals } = require("./financeMath");

/**
 * One-file finance export. Sections stay separate, in this order:
 *   1. Separate worker expenses (each worker, then each line)
 *   2. Total worker expenses
 *   3. Total investment
 *   4. Total income
 *   5. Each site's worker expenses, income and investment
 *   6. Gross combining all of the above
 *
 * Totals use the same rules as the Finance page (financeMath.js):
 *   worker expense = labour earned + advances paid + Kharchi paid
 *   total expenses = worker expenses + material and other site expenses
 *   gross profit/loss = income - total expenses
 *   net position = gross profit/loss - investment
 */

const LINE_CAP = 20000;
const PDF_LINE_CAP = 500;
const FORMATS = {
  pdf: { ext: "pdf", contentType: "application/pdf" },
  doc: { ext: "doc", contentType: "application/msword" },
  xls: { ext: "xls", contentType: "application/vnd.ms-excel" }
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function normalizeExportFormat(format) {
  const value = String(format || "pdf").trim().toLowerCase();
  if (value === "docx" || value === "word") return "doc";
  if (value === "xlsx" || value === "excel") return "xls";
  return FORMATS[value] ? value : null;
}

function exportPeriodError(period) {
  if (period?.from && period?.to && period.from > period.to) {
    return "The start date must be on or before the end date.";
  }
  return null;
}

function toPaise(value) {
  if (value == null || value === "") return 0;
  const raw = typeof value === "object" && typeof value.toString === "function"
    ? value.toString()
    : value;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function normalizeId(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (typeof value.toHexString === "function") return value.toHexString();
  }
  return String(value);
}

function dateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  if (!year || !day || monthIndex < 0 || monthIndex > 11) return iso;
  return `${day} ${MONTHS[monthIndex]} ${year}`;
}

function formatGeneratedAt(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const iso = d.toISOString();
  return `${formatDisplayDate(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
}

function periodLabel(period) {
  if (!period?.from && !period?.to) return "All dates";
  if (period.from && period.to) return `${formatDisplayDate(period.from)} to ${formatDisplayDate(period.to)}`;
  if (period.from) return `From ${formatDisplayDate(period.from)}`;
  return `Up to ${formatDisplayDate(period.to)}`;
}

function groupIndian(digits) {
  if (digits.length <= 3) return digits;
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${tail}`;
}

function formatExportRs(paise) {
  const rounded = Math.round(Number(paise) || 0);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const rupees = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `Rs ${negative ? "-" : ""}${groupIndian(String(rupees))}.${frac}`;
}

function rupeeNumber(paise) {
  return Number((Math.round(Number(paise) || 0) / 100).toFixed(2));
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });
}

function byDateDesc(a, b) {
  const date = String(b.date || "").localeCompare(String(a.date || ""));
  if (date) return date;
  return compareText(a.name || a.siteName || "", b.name || b.siteName || "");
}

function emptyBucket(site) {
  return {
    site,
    incomePaise: 0,
    materialPaise: 0,
    labourPaise: 0,
    advancePaise: 0,
    kharchiPaise: 0,
    investmentPaise: 0,
    workers: new Map()
  };
}

function classifyLedger(entry) {
  const type = entry.type;
  if (type === "EARNING" || type === "OVERTIME") {
    return {
      counted: true,
      field: "labourPaise",
      label: type === "OVERTIME" ? "Labour (overtime)" : "Labour (earnings)",
      amountPaise: toPaise(entry.creditPaise)
    };
  }
  if (type === "ADVANCE_DEDUCTION") {
    return { counted: true, field: "advancePaise", label: "Advance paid", amountPaise: toPaise(entry.debitPaise) };
  }
  if (type === "KHARCHI_DEDUCTION") {
    return { counted: true, field: "kharchiPaise", label: "Kharchi paid", amountPaise: toPaise(entry.debitPaise) };
  }
  if (type === "REVERSAL" || type === "ADJUSTMENT") {
    const credit = toPaise(entry.creditPaise);
    const debit = toPaise(entry.debitPaise);
    return {
      counted: false,
      field: null,
      label: type === "REVERSAL" ? "Attendance reversal" : "Salary adjustment",
      amountPaise: debit || credit
    };
  }
  return null;
}

function capLines(lines, cap) {
  const sorted = [...lines].sort(byDateDesc);
  if (sorted.length <= cap) return { lines: sorted, truncated: false, total: sorted.length };
  return { lines: sorted.slice(0, cap), truncated: true, total: sorted.length };
}

function workerTotal(worker) {
  return worker.labourPaise + worker.advancePaise + worker.kharchiPaise;
}

function buildFinancialExport(input = {}) {
  const generatedAt = input.generatedAt ? new Date(input.generatedAt) : new Date();
  const period = { from: input.period?.from || null, to: input.period?.to || null };
  const lineCap = Number.isInteger(input.lineCap) && input.lineCap > 0 ? input.lineCap : LINE_CAP;
  const sites = (input.sites || []).map((site) => ({
    id: normalizeId(site.id || site._id),
    name: site.name || "Unnamed site",
    code: site.code || "-",
    status: site.status || ""
  })).filter((site) => site.id);
  const siteIds = new Set(sites.map((site) => site.id));
  const workerDirectory = new Map();
  for (const worker of input.workers || []) {
    const id = normalizeId(worker.id || worker._id);
    if (!id) continue;
    workerDirectory.set(id, {
      id,
      employeeId: worker.employeeId || "-",
      name: (worker.name || "").trim() || worker.employeeId || "Unknown worker"
    });
  }
  const buckets = new Map(sites.map((site) => [site.id, emptyBucket(site)]));
  const unlinked = {
    incomePaise: 0,
    materialPaise: 0,
    investmentPaise: 0,
    workerExpensesPaise: 0,
    lines: []
  };
  const incomeLines = [];
  const investmentLines = [];
  const materialLines = [];
  const workerLines = [];
  const corrections = [];

  const siteOf = (siteId) => (siteIds.has(siteId) ? buckets.get(siteId).site : null);
  const workerOf = (workerId) => workerDirectory.get(workerId) || {
    id: workerId || "unknown",
    employeeId: "-",
    name: "Unknown worker"
  };

  for (const tx of input.transactions || []) {
    const siteId = normalizeId(tx.siteId || tx.site);
    const amount = toPaise(tx.amountPaise);
    if (tx.direction !== "INCOME" && tx.direction !== "EXPENSE") continue;
    const site = siteOf(siteId);
    const line = {
      date: dateKey(tx.date),
      siteName: site?.name || "Unlinked",
      siteCode: site?.code || "-",
      category: String(tx.category || "-").replace(/_/g, " "),
      description: tx.description || "",
      reversal: tx.reversalOf ? "Yes" : "No",
      amountPaise: amount
    };
    if (!site) {
      if (tx.direction === "INCOME") unlinked.incomePaise += amount;
      else unlinked.materialPaise += amount;
      unlinked.lines.push({
        date: line.date,
        kind: tx.direction === "INCOME" ? "Income" : "Material / other expense",
        description: line.description || line.category,
        amountPaise: amount
      });
      continue;
    }
    if (tx.direction === "INCOME") {
      buckets.get(siteId).incomePaise += amount;
      incomeLines.push(line);
    } else {
      buckets.get(siteId).materialPaise += amount;
      materialLines.push(line);
    }
  }

  for (const inv of input.investments || []) {
    const siteId = normalizeId(inv.siteId || inv.site);
    const signed = (inv.reversalOf ? -1 : 1) * toPaise(inv.amountPaise);
    const site = siteOf(siteId);
    const line = {
      date: dateKey(inv.date),
      siteName: site?.name || "Unlinked",
      siteCode: site?.code || "-",
      type: String(inv.type || "CASH").replace(/_/g, " "),
      reference: inv.reference || "",
      note: inv.note || "",
      reversal: inv.reversalOf ? "Yes" : "No",
      amountPaise: signed
    };
    if (!site) {
      unlinked.investmentPaise += signed;
      unlinked.lines.push({
        date: line.date,
        kind: "Investment",
        description: line.note || line.reference || line.type,
        amountPaise: signed
      });
      continue;
    }
    buckets.get(siteId).investmentPaise += signed;
    investmentLines.push(line);
  }

  for (const entry of input.ledger || []) {
    const classified = classifyLedger(entry);
    if (!classified || classified.amountPaise === 0) continue;
    const siteId = normalizeId(entry.siteId || entry.site);
    const worker = workerOf(normalizeId(entry.workerId || entry.worker));
    const site = siteOf(siteId);
    const line = {
      date: dateKey(entry.date),
      employeeId: worker.employeeId,
      name: worker.name,
      siteName: site?.name || "Unlinked",
      siteCode: site?.code || "-",
      kind: classified.label,
      description: entry.description || "",
      reference: entry.reference || "",
      amountPaise: classified.amountPaise,
      counted: classified.counted ? "Yes" : "No"
    };
    if (!classified.counted) {
      corrections.push(line);
      continue;
    }
    if (!site) {
      unlinked.workerExpensesPaise += classified.amountPaise;
      unlinked.lines.push({
        date: line.date,
        kind: classified.label,
        description: `${worker.employeeId} ${worker.name}`.trim(),
        amountPaise: classified.amountPaise
      });
      continue;
    }
    const bucket = buckets.get(siteId);
    bucket[classified.field] += classified.amountPaise;
    const current = bucket.workers.get(worker.id) || {
      workerId: worker.id,
      employeeId: worker.employeeId,
      name: worker.name,
      labourPaise: 0,
      advancePaise: 0,
      kharchiPaise: 0
    };
    current[classified.field] += classified.amountPaise;
    bucket.workers.set(worker.id, current);
    workerLines.push(line);
  }

  const siteRows = sites.map((site) => {
    const bucket = buckets.get(site.id);
    const finance = computeSiteFinanceRow({
      investmentPaise: bucket.investmentPaise,
      incomePaise: bucket.incomePaise,
      expensePaise: bucket.materialPaise,
      labourPaise: bucket.labourPaise,
      workerPayoutPaise: bucket.advancePaise + bucket.kharchiPaise
    });
    const workersOnSite = [...bucket.workers.values()]
      .map((worker) => ({ ...worker, totalPaise: workerTotal(worker) }))
      .sort((a, b) => compareText(a.name, b.name) || compareText(a.employeeId, b.employeeId));
    return {
      siteId: site.id,
      siteName: site.name,
      siteCode: site.code,
      status: site.status,
      investmentPaise: finance.investmentPaise,
      incomePaise: finance.incomePaise,
      labourPaise: finance.labourPaise,
      advancePaise: bucket.advancePaise,
      kharchiPaise: bucket.kharchiPaise,
      workerPayoutPaise: finance.workerPayoutPaise,
      workerExpensesPaise: finance.labourPaise + finance.workerPayoutPaise,
      materialPaise: finance.expensePaise,
      totalExpensesPaise: finance.totalExpensesPaise,
      profitLossPaise: finance.profitLossPaise,
      netPositionPaise: finance.netPositionPaise,
      workers: workersOnSite,
      finance
    };
  }).sort((a, b) => compareText(a.siteName, b.siteName) || compareText(a.siteCode, b.siteCode));

  const gross = computeGrossTotals(siteRows.map((site) => site.finance));
  const workerMap = new Map();
  for (const site of siteRows) {
    for (const worker of site.workers) {
      const current = workerMap.get(worker.workerId) || {
        workerId: worker.workerId,
        employeeId: worker.employeeId,
        name: worker.name,
        siteNames: [],
        labourPaise: 0,
        advancePaise: 0,
        kharchiPaise: 0
      };
      current.siteNames.push(site.siteName);
      current.labourPaise += worker.labourPaise;
      current.advancePaise += worker.advancePaise;
      current.kharchiPaise += worker.kharchiPaise;
      workerMap.set(worker.workerId, current);
    }
  }
  const workerRows = [...workerMap.values()]
    .map((worker) => ({
      ...worker,
      siteNames: [...new Set(worker.siteNames)].sort(compareText).join(", "),
      totalPaise: workerTotal(worker)
    }))
    .sort((a, b) => compareText(a.name, b.name) || compareText(a.employeeId, b.employeeId));

  const cappedWorkers = capLines(workerLines, lineCap);
  const cappedIncome = capLines(incomeLines, lineCap);
  const cappedInvestment = capLines(investmentLines, lineCap);
  const cappedMaterial = capLines(materialLines, lineCap);
  const cappedCorrections = capLines(corrections, lineCap);
  const hasUnlinked = unlinked.incomePaise || unlinked.materialPaise || unlinked.investmentPaise
    || unlinked.workerExpensesPaise || unlinked.lines.length;

  return {
    title: "Ananta Infratech Solutions",
    generatedAt: generatedAt.toISOString(),
    generatedAtLabel: formatGeneratedAt(generatedAt),
    period,
    periodLabel: periodLabel(period),
    filenameStem: filenameStem(period, generatedAt),
    workers: workerRows,
    workerLines: cappedWorkers.lines,
    workerLineCount: cappedWorkers.total,
    workerLinesTruncated: cappedWorkers.truncated,
    corrections: cappedCorrections.lines,
    correctionCount: cappedCorrections.total,
    correctionsTruncated: cappedCorrections.truncated,
    incomeLines: cappedIncome.lines,
    incomeLineCount: cappedIncome.total,
    incomeLinesTruncated: cappedIncome.truncated,
    investmentLines: cappedInvestment.lines,
    investmentLineCount: cappedInvestment.total,
    investmentLinesTruncated: cappedInvestment.truncated,
    materialLines: cappedMaterial.lines,
    materialLineCount: cappedMaterial.total,
    materialLinesTruncated: cappedMaterial.truncated,
    sites: siteRows,
    unlinked: hasUnlinked ? { ...unlinked, lines: capLines(unlinked.lines, lineCap).lines } : null,
    totals: {
      workerExpensesPaise: gross.labourPaise + gross.workerPayoutPaise,
      labourPaise: gross.labourPaise,
      advancePaise: siteRows.reduce((sum, site) => sum + site.advancePaise, 0),
      kharchiPaise: siteRows.reduce((sum, site) => sum + site.kharchiPaise, 0),
      workerPayoutPaise: gross.workerPayoutPaise,
      investmentPaise: gross.investmentPaise,
      incomePaise: gross.incomePaise,
      materialPaise: gross.expensePaise,
      totalExpensesPaise: gross.totalExpensesPaise,
      grossProfitPaise: gross.grossProfitPaise,
      grossLossPaise: gross.grossLossPaise,
      grossProfitLossPaise: gross.grossProfitLossPaise,
      netPositionPaise: gross.netPositionPaise,
      siteCount: siteRows.length,
      workerCount: workerRows.length
    }
  };
}

function filenameStem(period, generatedAt) {
  const day = generatedAt.toISOString().slice(0, 10);
  if (period?.from || period?.to) {
    return `ananta-finance-${period.from || "start"}_to_${period.to || "end"}-${day}`;
  }
  return `ananta-finance-all-dates-${day}`;
}

const NOTES = [
  "This is one file. Each numbered section is kept separate.",
  "1. Separate worker expenses - each worker, then each wage, advance and Kharchi line.",
  "2. Total worker expenses - the company-wide worker cost.",
  "3. Total investment - money the admin put into sites, after reversals.",
  "4. Total income - money the sites earned.",
  "5. Each site - that site's worker expenses, income and investment.",
  "6. Gross - all of the above combined.",
  "Worker expense = labour earned (wages and overtime) + advances paid + Kharchi paid.",
  "Total expenses = total worker expenses + material and other site expenses.",
  "Gross profit / loss = total income - total expenses. This matches the Finance page.",
  "Net position = gross profit / loss - total investment. Investment is not an operating expense.",
  "A reversed investment is subtracted. A reversed income or expense stays in the ledger as the opposite entry, the same way the Finance page counts it.",
  "Attendance reversals and salary adjustments are listed apart from the totals, because the Finance page does not include them.",
  "Office company expenses are not in this gross. They stay on the Finance page under Company Expenses.",
  "Amounts are Indian Rupees. An export with no dates matches the gross summary on the Finance page."
];

function moneyPair(label, paise) {
  return { label, value: formatExportRs(paise), paise, money: true };
}

function textPair(label, value) {
  return { label, value: value == null || value === "" ? "-" : String(value), money: false };
}

function truncationNote(shown, total, truncated) {
  if (!truncated) return null;
  return `This list shows ${shown} of ${total} lines. Totals include every line.`;
}

const WORKER_COLUMNS = [
  { key: "employeeId", header: "Employee ID", width: 72 },
  { key: "name", header: "Name", width: 100 },
  { key: "siteNames", header: "Sites", width: 96 },
  { key: "labourPaise", header: "Labour", width: 64, align: "right", money: true },
  { key: "advancePaise", header: "Advances paid", width: 64, align: "right", money: true },
  { key: "kharchiPaise", header: "Kharchi paid", width: 64, align: "right", money: true },
  { key: "totalPaise", header: "Total", width: 63, align: "right", money: true }
];

const LINE_COLUMNS = [
  { key: "date", header: "Date", width: 58 },
  { key: "employeeId", header: "Employee ID", width: 58 },
  { key: "name", header: "Name", width: 78 },
  { key: "siteName", header: "Site", width: 72 },
  { key: "kind", header: "Kind", width: 78 },
  { key: "description", header: "Description", width: 114 },
  { key: "amountPaise", header: "Amount", width: 65, align: "right", money: true }
];

const SITE_COLUMNS = [
  { key: "siteName", header: "Site", width: 88 },
  { key: "siteCode", header: "Code", width: 40 },
  { key: "workerExpensesPaise", header: "Worker expenses", width: 68, align: "right", money: true },
  { key: "incomePaise", header: "Income", width: 62, align: "right", money: true },
  { key: "investmentPaise", header: "Investment", width: 62, align: "right", money: true },
  { key: "materialPaise", header: "Other costs", width: 68, align: "right", money: true },
  { key: "profitLossPaise", header: "Profit / loss", width: 68, align: "right", money: true },
  { key: "netPositionPaise", header: "Net position", width: 67, align: "right", money: true }
];

function buildFinanceExportDocument(report) {
  const totals = report.totals;
  const siteTotal = {
    siteName: "All sites",
    siteCode: "",
    workerExpensesPaise: totals.workerExpensesPaise,
    incomePaise: totals.incomePaise,
    investmentPaise: totals.investmentPaise,
    materialPaise: totals.materialPaise,
    profitLossPaise: totals.grossProfitLossPaise,
    netPositionPaise: totals.netPositionPaise,
    bold: true
  };
  const sections = [
    {
      id: "workers",
      title: "1. Separate worker expenses",
      sheet: "Worker expenses",
      blocks: [
        { kind: "paragraph", text: "Each worker is listed separately. The total for a worker is labour earned plus advances paid plus Kharchi paid, across every site they worked on." },
        { kind: "table", sheet: "Worker expenses", columns: WORKER_COLUMNS, rows: report.workers },
        { kind: "heading", text: "Each worker expense line", sheet: "Worker lines" },
        { kind: "paragraph", sheet: "Worker lines", text: "Every counted wage, advance and Kharchi line. Labour is the wage earned. Advances and Kharchi are cash paid to the worker." },
        truncationNote(report.workerLines.length, report.workerLineCount, report.workerLinesTruncated)
          ? { kind: "paragraph", sheet: "Worker lines", text: truncationNote(report.workerLines.length, report.workerLineCount, report.workerLinesTruncated) }
          : null,
        {
          kind: "table",
          sheet: "Worker lines",
          columns: LINE_COLUMNS,
          rows: report.workerLines,
          totalCount: report.workerLineCount,
          pdfMaxRows: PDF_LINE_CAP
        },
        report.corrections.length ? { kind: "heading", text: "Not included in the totals", sheet: "Corrections" } : null,
        report.corrections.length ? {
          kind: "paragraph",
          sheet: "Corrections",
          text: "Attendance reversals and salary adjustments are shown here so they are not lost. They are not added into worker expenses or the gross, because the Finance page does not include them."
        } : null,
        report.corrections.length ? {
          kind: "table",
          sheet: "Corrections",
          columns: LINE_COLUMNS,
          rows: report.corrections,
          totalCount: report.correctionCount,
          pdfMaxRows: PDF_LINE_CAP
        } : null
      ].filter(Boolean)
    },
    {
      id: "worker-total",
      title: "2. Total worker expenses",
      sheet: "Total worker expenses",
      blocks: [
        { kind: "paragraph", text: "Company-wide worker cost. This is the sum of every worker in section 1, and of every site's worker expenses in section 5." },
        {
          kind: "pairs",
          rows: [
            moneyPair("Total worker expenses", totals.workerExpensesPaise),
            moneyPair("Labour (wages and overtime)", totals.labourPaise),
            moneyPair("Advances paid", totals.advancePaise),
            moneyPair("Kharchi paid", totals.kharchiPaise),
            textPair("Workers", totals.workerCount)
          ]
        }
      ]
    },
    {
      id: "investment",
      title: "3. Total investment",
      sheet: "Total investment",
      blocks: [
        { kind: "paragraph", text: "Money, material and equipment the admin put into sites. Reversal entries are subtracted. Investment is not an operating expense." },
        { kind: "pairs", rows: [moneyPair("Total investment", totals.investmentPaise)] },
        truncationNote(report.investmentLines.length, report.investmentLineCount, report.investmentLinesTruncated)
          ? { kind: "paragraph", text: truncationNote(report.investmentLines.length, report.investmentLineCount, report.investmentLinesTruncated) }
          : null,
        {
          kind: "heading",
          text: "Investment lines"
        },
        {
          kind: "table",
          columns: [
            { key: "date", header: "Date", width: 58 },
            { key: "siteName", header: "Site", width: 90 },
            { key: "type", header: "Type", width: 70 },
            { key: "reference", header: "Reference", width: 70 },
            { key: "note", header: "Note", width: 110 },
            { key: "reversal", header: "Reversal", width: 50 },
            { key: "amountPaise", header: "Amount", width: 75, align: "right", money: true }
          ],
          rows: report.investmentLines,
          totalCount: report.investmentLineCount,
          pdfMaxRows: PDF_LINE_CAP
        }
      ].filter(Boolean)
    },
    {
      id: "income",
      title: "4. Total income",
      sheet: "Total income",
      blocks: [
        { kind: "paragraph", text: "Money the sites earned from clients and other income. This is not the same as investment." },
        { kind: "pairs", rows: [moneyPair("Total income", totals.incomePaise)] },
        truncationNote(report.incomeLines.length, report.incomeLineCount, report.incomeLinesTruncated)
          ? { kind: "paragraph", text: truncationNote(report.incomeLines.length, report.incomeLineCount, report.incomeLinesTruncated) }
          : null,
        { kind: "heading", text: "Income lines" },
        {
          kind: "table",
          title: "Income lines",
          columns: [
            { key: "date", header: "Date", width: 58 },
            { key: "siteName", header: "Site", width: 100 },
            { key: "category", header: "Category", width: 90 },
            { key: "description", header: "Description", width: 150 },
            { key: "reversal", header: "Reversal", width: 50 },
            { key: "amountPaise", header: "Amount", width: 75, align: "right", money: true }
          ],
          rows: report.incomeLines,
          totalCount: report.incomeLineCount,
          pdfMaxRows: PDF_LINE_CAP
        }
      ].filter(Boolean)
    },
    {
      id: "sites",
      title: "5. Each site - worker expenses, income and investment",
      sheet: "Sites",
      blocks: [
        { kind: "paragraph", sheet: "Sites", text: "Every current site is listed, including sites with zero in a column. Worker expenses, income and investment are separate columns." },
        { kind: "table", sheet: "Sites", columns: SITE_COLUMNS, rows: [...report.sites, siteTotal] },
        {
          kind: "table",
          sheet: "Site workers",
          formats: ["xls"],
          columns: [
            { key: "siteName", header: "Site", width: 90 },
            { key: "siteCode", header: "Code", width: 44 },
            { key: "employeeId", header: "Employee ID", width: 70 },
            { key: "name", header: "Name", width: 100 },
            { key: "labourPaise", header: "Labour", width: 60, align: "right", money: true },
            { key: "advancePaise", header: "Advances paid", width: 64, align: "right", money: true },
            { key: "kharchiPaise", header: "Kharchi paid", width: 60, align: "right", money: true },
            { key: "totalPaise", header: "Worker expense", width: 70, align: "right", money: true }
          ],
          rows: report.sites.flatMap((site) => (
            site.workers.length ? site.workers.map((worker) => ({
              siteName: site.siteName,
              siteCode: site.siteCode,
              ...worker
            })) : [{
              siteName: site.siteName,
              siteCode: site.siteCode,
              employeeId: "-",
              name: "No worker expenses",
              labourPaise: 0,
              advancePaise: 0,
              kharchiPaise: 0,
              totalPaise: 0
            }]
          ))
        },
        ...report.sites.flatMap((site) => ([
          { kind: "heading", formats: ["pdf", "doc"], text: `Site: ${site.siteName} (${site.siteCode})` },
          {
            kind: "pairs",
            formats: ["pdf", "doc"],
            rows: [
              textPair("Status", site.status || "-"),
              moneyPair("Worker expenses", site.workerExpensesPaise),
              moneyPair("Labour", site.labourPaise),
              moneyPair("Advances paid", site.advancePaise),
              moneyPair("Kharchi paid", site.kharchiPaise),
              moneyPair("Income", site.incomePaise),
              moneyPair("Investment", site.investmentPaise),
              moneyPair("Material and other expenses", site.materialPaise),
              moneyPair("Total expenses", site.totalExpensesPaise),
              moneyPair("Profit / loss", site.profitLossPaise),
              moneyPair("Net position", site.netPositionPaise)
            ]
          },
          {
            kind: "table",
            formats: ["pdf", "doc"],
            title: "Workers on this site",
            columns: [
              { key: "employeeId", header: "Employee ID", width: 80 },
              { key: "name", header: "Name", width: 130 },
              { key: "labourPaise", header: "Labour", width: 78, align: "right", money: true },
              { key: "advancePaise", header: "Advances paid", width: 78, align: "right", money: true },
              { key: "kharchiPaise", header: "Kharchi paid", width: 78, align: "right", money: true },
              { key: "totalPaise", header: "Worker expense", width: 79, align: "right", money: true }
            ],
            rows: site.workers
          }
        ]))
      ]
    },
    {
      id: "gross",
      title: "6. Gross",
      sheet: "Gross",
      blocks: [
        { kind: "paragraph", text: "The gross combines every site: total worker expenses, total investment, total income, and material and other expenses. It uses the same rules as the Finance page." },
        { kind: "paragraph", text: "Gross profit / loss = total income - total expenses. Total expenses = total worker expenses + material and other expenses. Net position = gross profit / loss - total investment." },
        {
          kind: "pairs",
          rows: [
            moneyPair("Total worker expenses", totals.workerExpensesPaise),
            moneyPair("Total investment", totals.investmentPaise),
            moneyPair("Total income", totals.incomePaise),
            moneyPair("Material and other expenses", totals.materialPaise),
            moneyPair("Total expenses", totals.totalExpensesPaise),
            moneyPair("Gross profit (sites in profit)", totals.grossProfitPaise),
            moneyPair("Gross loss (sites in loss)", totals.grossLossPaise),
            moneyPair("Gross profit / loss", totals.grossProfitLossPaise),
            moneyPair("Net position after investment", totals.netPositionPaise),
            textPair("Sites included", totals.siteCount),
            textPair("Workers with expenses", totals.workerCount),
            textPair("Period", report.periodLabel)
          ]
        },
        { kind: "heading", text: "Each site in the gross" },
        {
          kind: "table",
          columns: [
            { key: "siteName", header: "Site", width: 110 },
            { key: "siteCode", header: "Code", width: 48 },
            { key: "workerExpensesPaise", header: "Worker expenses", width: 78, align: "right", money: true },
            { key: "incomePaise", header: "Income", width: 70, align: "right", money: true },
            { key: "investmentPaise", header: "Investment", width: 70, align: "right", money: true },
            { key: "profitLossPaise", header: "Profit / loss", width: 74, align: "right", money: true },
            { key: "netPositionPaise", header: "Net position", width: 73, align: "right", money: true }
          ],
          rows: [...report.sites, siteTotal]
        },
        { kind: "heading", text: "Material and other expenses in the gross", sheet: "Material expenses" },
        { kind: "paragraph", sheet: "Material expenses", text: "These are site expenses that are not worker wages, advances or Kharchi. They are included so the gross can be checked against the Finance page." },
        truncationNote(report.materialLines.length, report.materialLineCount, report.materialLinesTruncated)
          ? { kind: "paragraph", sheet: "Material expenses", text: truncationNote(report.materialLines.length, report.materialLineCount, report.materialLinesTruncated) }
          : null,
        {
          kind: "table",
          sheet: "Material expenses",
          columns: [
            { key: "date", header: "Date", width: 58 },
            { key: "siteName", header: "Site", width: 110 },
            { key: "category", header: "Category", width: 90 },
            { key: "description", header: "Description", width: 150 },
            { key: "reversal", header: "Reversal", width: 50 },
            { key: "amountPaise", header: "Amount", width: 65, align: "right", money: true }
          ],
          rows: report.materialLines,
          totalCount: report.materialLineCount,
          pdfMaxRows: PDF_LINE_CAP
        }
      ].filter(Boolean)
    }
  ];

  if (report.unlinked) {
    sections.push({
      id: "unlinked",
      title: "Records not linked to a current site",
      sheet: "Unlinked records",
      blocks: [
        { kind: "paragraph", text: "These records point at a site that is not in the current site list. They are not included in sections 1 to 6, and they are not included in the Finance page gross either." },
        {
          kind: "pairs",
          rows: [
            moneyPair("Unlinked worker expenses", report.unlinked.workerExpensesPaise),
            moneyPair("Unlinked investment", report.unlinked.investmentPaise),
            moneyPair("Unlinked income", report.unlinked.incomePaise),
            moneyPair("Unlinked material / other", report.unlinked.materialPaise)
          ]
        },
        {
          kind: "table",
          columns: [
            { key: "date", header: "Date", width: 70 },
            { key: "kind", header: "Kind", width: 140 },
            { key: "description", header: "Description", width: 220 },
            { key: "amountPaise", header: "Amount", width: 93, align: "right", money: true }
          ],
          rows: report.unlinked.lines
        }
      ]
    });
  }

  return {
    title: report.title,
    subtitle: "Finance export",
    periodLabel: report.periodLabel,
    generatedAtLabel: report.generatedAtLabel,
    filenameStem: report.filenameStem,
    notes: NOTES,
    headline: [
      moneyPair("Total worker expenses", totals.workerExpensesPaise),
      moneyPair("Total investment", totals.investmentPaise),
      moneyPair("Total income", totals.incomePaise),
      moneyPair("Gross profit / loss", totals.grossProfitLossPaise)
    ],
    sections
  };
}

function renderFinancialExport(report, format) {
  const normalized = normalizeExportFormat(format);
  if (!normalized) {
    const error = new Error("Choose a file type: PDF, Word (.doc), or Excel (.xls).");
    error.statusCode = 422;
    throw error;
  }
  const document = buildFinanceExportDocument(report);
  const meta = FORMATS[normalized];
  const buffer = normalized === "pdf"
    ? renderPdf(document)
    : normalized === "doc"
      ? renderDoc(document)
      : renderXls(document);
  return {
    format: normalized,
    filename: `${document.filenameStem}.${meta.ext}`,
    contentType: meta.contentType,
    buffer
  };
}

function blocksFor(blocks, format) {
  return (blocks || []).filter((block) => !block.formats || block.formats.includes(format));
}

function cellText(column, row) {
  if (column.money) return formatExportRs(row[column.key] || 0);
  const value = row[column.key];
  if (value == null || value === "") return "-";
  if (column.key === "date") return formatDisplayDate(String(value));
  return String(value);
}

function wrapText(text, width) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const word of words) {
    const piece = word.length > width ? word.slice(0, width) : word;
    const next = line ? `${line} ${piece}` : piece;
    if (next.length > width && line) {
      lines.push(line);
      line = piece;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderPdf(document) {
  const layout = new PdfLayout(document);
  layout.heading(`${document.title} - ${document.subtitle}`);
  layout.pairs([
    textPair("Period", document.periodLabel),
    textPair("Generated", document.generatedAtLabel)
  ]);
  layout.subheading("How this file is separated");
  for (const note of document.notes) layout.paragraph(note);
  layout.subheading("Headline figures");
  layout.pairs(document.headline);
  for (const section of document.sections) {
    layout.pageBreak();
    layout.heading(section.title);
    for (const block of blocksFor(section.blocks, "pdf")) layout.block(block);
  }
  return buildPdf(layout.finish(), { title: `${document.title} finance export` });
}

function renderDoc(document) {
  const parts = [];
  parts.push("<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:w=\"urn:schemas-microsoft-com:office:word\" xmlns=\"http://www.w3.org/TR/REC-html40\">");
  parts.push("<head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">");
  parts.push(`<title>${htmlEscape(document.title)} finance export</title>`);
  parts.push("<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->");
  parts.push("<style>");
  parts.push("@page { size: A4; margin: 1.6cm; }");
  parts.push("body { font-family: Calibri, Arial, sans-serif; color: #1f2933; }");
  parts.push("h1 { font-size: 22px; margin: 0 0 6px; }");
  parts.push("h2 { font-size: 16px; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 3px solid #c97a1f; }");
  parts.push("h3 { font-size: 13px; margin: 16px 0 6px; }");
  parts.push("p { font-size: 12px; line-height: 1.45; margin: 0 0 8px; }");
  parts.push("table { border-collapse: collapse; width: 100%; margin: 6px 0 14px; }");
  parts.push("th { background: #1f2933; color: #fff; text-align: left; padding: 5px 7px; font-size: 11px; }");
  parts.push("td { border-bottom: 1px solid #e5e7eb; padding: 4px 7px; font-size: 11px; vertical-align: top; }");
  parts.push("td.num, th.num { text-align: right; font-family: Consolas, monospace; }");
  parts.push("tr.total td { font-weight: bold; border-top: 2px solid #1f2933; }");
  parts.push(".section { page-break-before: always; }");
  parts.push(".muted { color: #52606d; }");
  parts.push("</style></head><body>");
  parts.push(`<h1>${htmlEscape(document.title)}</h1>`);
  parts.push(`<p class="muted">${htmlEscape(document.subtitle)} · ${htmlEscape(document.periodLabel)} · Generated ${htmlEscape(document.generatedAtLabel)}</p>`);
  parts.push("<h3>How this file is separated</h3>");
  for (const note of document.notes) parts.push(`<p>${htmlEscape(note)}</p>`);
  parts.push("<h3>Headline figures</h3>");
  parts.push(htmlPairs(document.headline));
  for (const section of document.sections) {
    parts.push(`<div class="section"><h2>${htmlEscape(section.title)}</h2>`);
    for (const block of blocksFor(section.blocks, "doc")) parts.push(htmlBlock(block));
    parts.push("</div>");
  }
  parts.push("</body></html>");
  return withBom(parts.join(""));
}

function renderXls(document) {
  const used = new Set();
  const sheets = [];
  const coverRows = [
    [{ v: document.title, style: "Title" }],
    [{ v: document.subtitle, style: "Section" }],
    [{ v: "Period", style: "Label" }, { v: document.periodLabel }],
    [{ v: "Generated", style: "Label" }, { v: document.generatedAtLabel }],
    [],
    [{ v: "How this file is separated", style: "Section" }]
  ];
  for (const note of document.notes) coverRows.push([{ v: note, style: "Note" }]);
  coverRows.push([]);
  coverRows.push([{ v: "Headline figures", style: "Section" }]);
  for (const pair of document.headline) coverRows.push(pairRow(pair));
  sheets.push(worksheet("Cover", coverRows, used));

  for (const section of document.sections) {
    const grouped = new Map();
    for (const block of blocksFor(section.blocks, "xls")) {
      const name = block.sheet || section.sheet || section.title;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(block);
    }
    let first = true;
    for (const [name, blocks] of grouped) {
      const rows = [];
      if (first) {
        rows.push([{ v: section.title, style: "Title" }]);
        rows.push([]);
        first = false;
      }
      for (const block of blocks) rows.push(...xlsBlock(block));
      sheets.push(worksheet(name, rows, used));
    }
  }

  const xml = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<?mso-application progid=\"Excel.Sheet\"?>",
    "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"",
    " xmlns:o=\"urn:schemas-microsoft-com:office:office\"",
    " xmlns:x=\"urn:schemas-microsoft-com:office:excel\"",
    " xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">",
    "<Styles>",
    "<Style ss:ID=\"Default\" ss:Name=\"Normal\"><Alignment ss:Vertical=\"Center\"/><Font ss:FontName=\"Calibri\" ss:Size=\"11\"/></Style>",
    "<Style ss:ID=\"Title\"><Font ss:FontName=\"Calibri\" ss:Bold=\"1\" ss:Size=\"16\" ss:Color=\"#1F2933\"/></Style>",
    "<Style ss:ID=\"Section\"><Font ss:FontName=\"Calibri\" ss:Bold=\"1\" ss:Size=\"13\" ss:Color=\"#1F2933\"/></Style>",
    "<Style ss:ID=\"Note\"><Font ss:FontName=\"Calibri\" ss:Italic=\"1\" ss:Size=\"10\" ss:Color=\"#52606D\"/></Style>",
    "<Style ss:ID=\"Label\"><Font ss:FontName=\"Calibri\" ss:Bold=\"1\"/></Style>",
    "<Style ss:ID=\"Header\"><Font ss:FontName=\"Calibri\" ss:Bold=\"1\" ss:Color=\"#FFFFFF\"/><Interior ss:Color=\"#1F2933\" ss:Pattern=\"Solid\"/></Style>",
    "<Style ss:ID=\"Money\"><NumberFormat ss:Format=\"#,##0.00\"/></Style>",
    "<Style ss:ID=\"MoneyBold\"><Font ss:Bold=\"1\"/><NumberFormat ss:Format=\"#,##0.00\"/></Style>",
    "<Style ss:ID=\"Bold\"><Font ss:Bold=\"1\"/></Style>",
    "</Styles>",
    sheets.join(""),
    "</Workbook>"
  ].join("");
  return withBom(xml);
}

function pairRow(pair) {
  if (pair.money) return [{ v: pair.label, style: "Label" }, { v: rupeeNumber(pair.paise), type: "Number", style: "Money" }];
  return [{ v: pair.label, style: "Label" }, { v: pair.value }];
}

function xlsBlock(block) {
  if (block.kind === "paragraph") return wrapText(block.text, 110).map((line) => [{ v: line, style: "Note" }]).concat([[]]);
  if (block.kind === "heading") return [[{ v: block.text, style: "Section" }]];
  if (block.kind === "pairs") return block.rows.map(pairRow).concat([[]]);
  if (block.kind === "table") {
    const rows = [];
    if (block.title) rows.push([{ v: block.title, style: "Section" }]);
    rows.push(block.columns.map((column) => ({ v: column.header, style: "Header" })));
    if (!block.rows.length) {
      rows.push([{ v: "None in this period.", style: "Note" }]);
    } else {
      for (const row of block.rows) {
        rows.push(block.columns.map((column) => {
          if (column.money) {
            return { v: rupeeNumber(row[column.key] || 0), type: "Number", style: row.bold ? "MoneyBold" : "Money" };
          }
          return { v: cellText(column, row), style: row.bold ? "Bold" : undefined };
        }));
      }
    }
    rows.push([]);
    return rows;
  }
  return [];
}

function worksheet(name, rows, used) {
  const safeName = uniqueSheetName(name, used);
  const body = rows.map((row) => {
    if (!row || row.length === 0) return "<Row></Row>";
    const cells = row.map((cell) => {
      const type = cell.type || "String";
      const style = cell.style ? ` ss:StyleID="${cell.style}"` : "";
      const value = type === "Number" ? Number(cell.v).toFixed(2) : xmlEscape(cell.v);
      return `<Cell${style}><Data ss:Type="${type}">${value}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");
  return `<Worksheet ss:Name="${xmlEscape(safeName)}"><Table>${body}</Table></Worksheet>`;
}

function uniqueSheetName(name, used) {
  const cleaned = String(name || "Sheet").replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim() || "Sheet";
  let candidate = cleaned.slice(0, 31);
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` ${n}`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function htmlBlock(block) {
  if (block.kind === "paragraph") return `<p>${htmlEscape(block.text)}</p>`;
  if (block.kind === "heading") return `<h3>${htmlEscape(block.text)}</h3>`;
  if (block.kind === "pairs") return htmlPairs(block.rows);
  if (block.kind === "table") return htmlTable(block);
  return "";
}

function htmlPairs(rows) {
  const body = rows.map((row) => (
    `<tr><td>${htmlEscape(row.label)}</td><td class="num">${htmlEscape(row.value)}</td></tr>`
  )).join("");
  return `<table><tbody>${body}</tbody></table>`;
}

function htmlTable(block) {
  const head = block.columns.map((column) => (
    `<th class="${column.align === "right" ? "num" : ""}">${htmlEscape(column.header)}</th>`
  )).join("");
  const rows = block.rows.length
    ? block.rows.map((row) => {
      const cells = block.columns.map((column) => (
        `<td class="${column.align === "right" ? "num" : ""}">${htmlEscape(cellText(column, row))}</td>`
      )).join("");
      return `<tr class="${row.bold ? "total" : ""}">${cells}</tr>`;
    }).join("")
    : `<tr><td colspan="${block.columns.length}">None in this period.</td></tr>`;
  const title = block.title ? `<h3>${htmlEscape(block.title)}</h3>` : "";
  return `${title}<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function withBom(text) {
  return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(text, "utf8")]);
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

class PdfLayout {
  constructor(document) {
    this.document = document;
    this.pages = [];
    this.hasContent = false;
    this.startPage();
  }

  startPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE_H - 52;
    this.hasContent = false;
    this.ops.push("0.82 0.84 0.86 RG");
    this.ops.push(`${MARGIN} ${PAGE_H - 32} m ${PAGE_W - MARGIN} ${PAGE_H - 32} l S`);
    this.ops.push(textAt(fitPdf(`Ananta Infratech - Finance export - ${this.document.periodLabel}`, 430, 8), MARGIN, PAGE_H - 26, 8, "F1", "0.35 0.39 0.44"));
    this.ops.push(textAt(`Page ${this.pages.length}`, PAGE_W - MARGIN - 42, PAGE_H - 26, 8, "F1", "0.35 0.39 0.44"));
    this.ops.push("0.82 0.84 0.86 RG");
    this.ops.push(`${MARGIN} 34 m ${PAGE_W - MARGIN} 34 l S`);
    this.ops.push(textAt(fitPdf(`Generated ${this.document.generatedAtLabel}`, 400, 7.5), MARGIN, 24, 7.5, "F1", "0.45 0.48 0.52"));
  }

  pageBreak() {
    if (this.hasContent) this.startPage();
  }

  ensure(height) {
    if (this.y - height < 46) this.startPage();
  }

  mark() {
    this.hasContent = true;
  }

  heading(text) {
    this.ensure(34);
    this.mark();
    this.ops.push(textAt(fitPdf(text, CONTENT_W, 13), MARGIN, this.y, 13, "F2", "0.12 0.15 0.18"));
    this.y -= 6;
    this.ops.push("1.6 w 0.79 0.48 0.12 RG");
    this.ops.push(`${MARGIN} ${round(this.y)} m ${MARGIN + 68} ${round(this.y)} l S`);
    this.ops.push("1 w");
    this.y -= 16;
  }

  subheading(text) {
    this.ensure(22);
    this.mark();
    this.ops.push(textAt(fitPdf(text, CONTENT_W, 10), MARGIN, this.y, 10, "F2", "0.12 0.15 0.18"));
    this.y -= 14;
  }

  paragraph(text) {
    this.mark();
    for (const line of wrapText(pdfPlain(text), 98)) {
      this.ensure(12);
      this.ops.push(textAt(line, MARGIN, this.y, 8.5, "F1", "0.25 0.28 0.32"));
      this.y -= 11;
    }
    this.y -= 4;
  }

  pairs(rows) {
    this.mark();
    for (const row of rows) {
      this.ensure(14);
      this.ops.push(textAt(fitPdf(row.label, 250, 9), MARGIN, this.y, 9, "F1", "0.32 0.36 0.40"));
      const value = fitPdf(row.value, 230, 9);
      const color = row.money && String(row.value).includes("-") ? "0.72 0.29 0.24" : "0.12 0.15 0.18";
      this.ops.push(textAt(value, rightX(value, PAGE_W - MARGIN, 9), this.y, 9, "F2", color));
      this.y -= 13;
    }
    this.y -= 4;
  }

  block(block) {
    if (block.kind === "paragraph") this.paragraph(block.text);
    else if (block.kind === "heading") this.subheading(block.text);
    else if (block.kind === "pairs") this.pairs(block.rows);
    else if (block.kind === "table") this.table(block);
  }

  table(block) {
    const columns = scaleColumns(block.columns);
    const fontSize = 7.5;
    const rowH = 13;
    const headH = 15;
    const drawHead = () => {
      const bottom = this.y - headH;
      this.ops.push("0.12 0.15 0.18 rg");
      this.ops.push(`${MARGIN} ${round(bottom)} ${CONTENT_W} ${headH} re f`);
      let x = MARGIN;
      for (const column of columns) {
        const label = fitPdf(column.header, column.width - 6, fontSize);
        const tx = column.align === "right" ? rightX(label, x + column.width - 3, fontSize) : x + 3;
        this.ops.push(textAt(label, tx, bottom + 4, fontSize, "F2", "1 1 1"));
        x += column.width;
      }
      this.y = bottom;
      this.mark();
    };
    const breakIfNeeded = (height) => {
      if (this.y - height < 46) {
        this.startPage();
        drawHead();
        return true;
      }
      return false;
    };
    if (block.title) this.subheading(block.title);
    if (!breakIfNeeded(headH + rowH)) drawHead();
    const limit = block.pdfMaxRows || block.rows.length;
    const shown = block.rows.slice(0, limit);
    if (!shown.length) {
      breakIfNeeded(rowH);
      this.ops.push(textAt("None in this period.", MARGIN + 3, this.y - 10, fontSize, "F1", "0.45 0.48 0.52"));
      this.y -= rowH + 8;
      return;
    }
    shown.forEach((row, index) => {
      if (this.y - rowH < 46) {
        this.startPage();
        drawHead();
      }
      const bottom = this.y - rowH;
      if (index % 2 === 1) {
        this.ops.push("0.96 0.97 0.98 rg");
        this.ops.push(`${MARGIN} ${round(bottom)} ${CONTENT_W} ${rowH} re f`);
      }
      let x = MARGIN;
      for (const column of columns) {
        const text = fitPdf(cellText(column, row), column.width - 6, fontSize);
        const negative = column.money && String(cellText(column, row)).includes("-");
        const tx = column.align === "right" ? rightX(text, x + column.width - 3, fontSize) : x + 3;
        this.ops.push(textAt(text, tx, bottom + 3.5, fontSize, row.bold ? "F2" : "F1", negative ? "0.72 0.29 0.24" : "0.12 0.15 0.18"));
        x += column.width;
      }
      this.ops.push("0.86 0.88 0.90 RG");
      this.ops.push(`${MARGIN} ${round(bottom)} m ${MARGIN + CONTENT_W} ${round(bottom)} l S`);
      this.y = bottom;
      this.mark();
    });
    this.y -= 8;
    const total = block.totalCount || block.rows.length;
    if (shown.length < total) {
      this.paragraph(`This PDF shows the first ${shown.length} of ${total} lines. Download Word or Excel for the longer list. Totals above include every line.`);
    }
  }

  finish() {
    return this.pages.map((ops) => ops.join("\n"));
  }
}

function scaleColumns(columns) {
  const sum = columns.reduce((total, column) => total + column.width, 0) || 1;
  const scale = CONTENT_W / sum;
  return columns.map((column) => ({ ...column, width: column.width * scale }));
}

function pdfPlain(value) {
  const ascii = String(value ?? "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
  return ascii || "-";
}

function fitPdf(value, width, size) {
  const text = pdfPlain(value);
  const max = Math.max(1, Math.floor(width / (size * 0.52)));
  if (text.length <= max) return text;
  if (max <= 2) return text.slice(0, max);
  return `${text.slice(0, max - 2)}..`;
}

function pdfLiteral(value) {
  return `(${pdfPlain(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

function textAt(text, x, y, size, font, color) {
  return `BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${round(x)} ${round(y)} Tm ${pdfLiteral(text)} Tj ET`;
}

function rightX(text, rightEdge, size) {
  return rightEdge - (pdfPlain(text).length * size * 0.52) - 1;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function buildPdf(pageContents, meta) {
  const contents = pageContents.length ? pageContents : ["BT /F1 12 Tf 36 800 Td (Empty report) Tj ET"];
  const n = contents.length;
  const infoId = 5 + n * 2;
  const objects = new Array(infoId);
  objects[0] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  const kids = [];
  for (let i = 0; i < n; i += 1) {
    const contentId = 5 + i;
    const pageId = 5 + n + i;
    kids.push(`${pageId} 0 R`);
    objects[contentId - 1] = { stream: Buffer.from(contents[i], "latin1") };
    objects[pageId - 1] = Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      "latin1"
    );
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Count ${n} /Kids [${kids.join(" ")}] >>`, "latin1");
  objects[2] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1");
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "latin1");
  objects[infoId - 1] = Buffer.from(
    `<< /Title ${pdfLiteral(meta.title || "Finance export")} /Author (Ananta Infratech Solutions) /Creator (Ananta Finance Export) >>`,
    "latin1"
  );

  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  let offset = chunks[0].length;
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(offset);
    const header = Buffer.from(`${i + 1} 0 obj\n`, "latin1");
    const body = objects[i].stream
      ? Buffer.concat([
        Buffer.from(`<< /Length ${objects[i].stream.length} >>\nstream\n`, "latin1"),
        objects[i].stream,
        Buffer.from("\nendstream", "latin1")
      ])
      : objects[i];
    const piece = Buffer.concat([header, body, Buffer.from("\nendobj\n", "latin1")]);
    chunks.push(piece);
    offset += piece.length;
  }
  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

module.exports = {
  LINE_CAP,
  PDF_LINE_CAP,
  normalizeExportFormat,
  exportPeriodError,
  formatExportRs,
  buildFinancialExport,
  buildFinanceExportDocument,
  renderFinancialExport
};
