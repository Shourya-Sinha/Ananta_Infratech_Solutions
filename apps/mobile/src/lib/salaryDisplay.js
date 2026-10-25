/** Helpers shared by the worker home and salary screens. */

export function currentMonthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}`;
}

/** Today's date (YYYY-MM-DD) in India, regardless of the phone's timezone. */
export function todayKeyIST(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Converts a statement payload into the numbers the UI renders (rupees). */
export function toRupeeView(statement) {
  if (!statement) return null;
  const t = statement.totals;
  const deductions = t.advanceDeductionsPaise + t.kharchiDeductionsPaise + t.otherDeductionsPaise;
  const share = (part) => (t.totalEarningsPaise ? Math.min(100, Math.round((part / t.totalEarningsPaise) * 100)) : 0);
  return {
    net: t.netSalaryPaise / 100,
    earnings: t.totalEarningsPaise / 100,
    gross: t.grossEarningsPaise / 100,
    overtime: t.overtimeEarningsPaise / 100,
    advances: t.advanceDeductionsPaise / 100,
    kharchi: t.kharchiDeductionsPaise / 100,
    other: t.otherDeductionsPaise / 100,
    deductions: deductions / 100,
    pendingAdvance: statement.pending.advancePaise / 100,
    pendingKharchi: statement.pending.kharchiPaise / 100,
    netPercent: share(Math.max(0, t.netSalaryPaise)),
    advancePercent: share(t.advanceDeductionsPaise),
    kharchiPercent: share(t.kharchiDeductionsPaise),
    daily: statement.daily,
    dailyAttendance: statement.dailyAttendance ?? [],
    salaryRates: statement.salaryRates ?? null,
    attendance: statement.attendance ?? null,
    payrollStatus: statement.payrollStatus ?? "LIVE"
  };
}
