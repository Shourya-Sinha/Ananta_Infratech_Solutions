import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatINR, formatDate, cx } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const EXPENSE_CATEGORIES = ["MATERIAL", "LABOUR", "TRANSPORT", "EQUIPMENT", "ELECTRICITY", "RENT", "FOOD", "MAINTENANCE", "VENDOR_PAYMENT", "OTHER"];
const INCOME_CATEGORIES = ["CLIENT_PAYMENT", "CONTRACT_PAYMENT", "MILESTONE_PAYMENT", "OTHER"];
const INVESTMENT_TYPES = ["CASH", "MATERIAL", "EQUIPMENT", "LABOUR_ADVANCE", "OTHER"];
const COMPANY_EXPENSE_CATEGORIES = ["OFFICE_RENT", "UTILITIES", "SALARIES_OFFICE", "TRAVEL", "MARKETING", "LEGAL", "ACCOUNTING", "INSURANCE", "MAINTENANCE", "OTHER"];
const TABS = ["profit-loss", "income", "expenses", "worker-payouts", "investments", "company-expenses", "budget-alerts"];

const today = () => new Date().toISOString().slice(0, 10);

function PnlValue({ value }) {
  const profit = value >= 0;
  return (
    <span className={cx("font-mono font-medium tabular-nums", profit ? "text-teal" : "text-rust")}>
      {formatINR(value)}
      {!profit && <span className="ml-1 text-xs uppercase">loss</span>}
    </span>
  );
}

function tabLabel(t) {
  switch (t) {
    case "profit-loss": return "Profit / Loss";
    case "worker-payouts": return "Worker Payouts";
    case "company-expenses": return "Company Expenses";
    case "budget-alerts": return "Budget Alerts";
    case "investments": return "Investments";
    case "income": return "Income";
    case "expenses": return "Expenses";
    default: return t;
  }
}

export function FinancePage() {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "profit-loss";
  const initialTab = TABS.includes(requestedTab) ? requestedTab : "profit-loss";

  const [tab, setTab] = useState(initialTab);
  const [site, setSite] = useState("");
  const qc = useQueryClient();
  const toast = useToast();

  const siteName = (siteId) => sites?.find((s) => s._id === siteId)?.name ?? "site";

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["finance", "summary"],
    queryFn: async () => unwrap(api.get("/finance/summary")),
  });
  const { data: sites } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites")),
  });
  const { data: profitLoss } = useQuery({
    queryKey: ["finance", "site-pnl", site],
    queryFn: async () => unwrap(api.get(`/finance/site/${site}/profit-loss`)),
    enabled: Boolean(site) && tab === "profit-loss",
  });
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["finance", tab, site],
    queryFn: async () => unwrap(api.get(`/finance/${tab}?site=${site}`)),
    enabled: Boolean(site) && (tab === "income" || tab === "expenses"),
  });
  const { data: investments, isLoading: investmentsLoading } = useQuery({
    queryKey: ["finance", "investments", site],
    queryFn: async () => unwrap(api.get(`/finance/investments?site=${site}`)),
    enabled: Boolean(site) && tab === "investments",
  });

  // Worker payouts (cash flow)
  const { data: cashFlow } = useQuery({
    queryKey: ["finance", "cash-flow", site],
    queryFn: async () => unwrap(api.get(`/finance/site/${site}/cash-flow`)),
    enabled: Boolean(site) && tab === "worker-payouts",
  });

  // Company expenses
  const { data: companyExpenses, isLoading: ceLoading } = useQuery({
    queryKey: ["finance", "company-expenses"],
    queryFn: async () => unwrap(api.get("/finance/company-expenses")),
    enabled: tab === "company-expenses",
  });

  // Budget alerts
  const { data: budgetAlerts } = useQuery({
    queryKey: ["finance", "budget-alerts"],
    queryFn: async () => unwrap(api.get("/finance/budget-alerts")),
    enabled: tab === "budget-alerts",
  });

  useSocketInvalidate("site:income_added", [["finance"]]);
  useSocketInvalidate("site:expense_added", [["finance"]]);
  useSocketInvalidate("site:investment_added", [["finance"]]);
  useSocketInvalidate("site:investment_reversed", [["finance"]]);
  useSocketInvalidate("site:capital_updated", [["finance"]]);
  useSocketInvalidate("site:profit_updated", [["finance"]]);
  useSocketInvalidate("company:expense_added", [["finance"]]);
  useSocketInvalidate("company:expense_reversed", [["finance"]]);

  // --- Generic transaction form (income/expense) ---
  const [form, setForm] = useState({ category: "", amountRupees: "", date: today(), description: "" });
  const [showForm, setShowForm] = useState(false);
  const record = useMutation({
    mutationFn: async (payload) => unwrap(api.post(`/finance/${payload.tab}`, payload.body)),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      setShowForm(false);
      setForm({ category: "", amountRupees: "", date: today(), description: "" });
      toast.success(`${payload.tab === "income" ? "Income" : "Expense"} of ${formatINR(Number(payload.body.amountRupees))} recorded for ${siteName(site)}.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the entry."),
  });

  // --- Investments ---
  const [invForm, setInvForm] = useState({ type: "CASH", amountRupees: "", date: today(), reference: "", note: "" });
  const [showInvForm, setShowInvForm] = useState(false);
  const addInvestment = useMutation({
    mutationFn: async (body) => unwrap(api.post("/finance/investments", body)),
    onSuccess: (_data, body) => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      setShowInvForm(false);
      setInvForm({ type: "CASH", amountRupees: "", date: today(), reference: "", note: "" });
      toast.success(`Investment of ${formatINR(Number(body.amountRupees))} added to ${siteName(site)}.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the investment."),
  });
  const reverseInvestment = useMutation({
    mutationFn: async (investmentId) => unwrap(api.post(`/finance/investments/${investmentId}/reverse`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Investment reversed.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reverse."),
  });

  // --- Capital ---
  const [capitalForm, setCapitalForm] = useState({ amountRupees: "", date: today(), source: "", reference: "" });
  const [showCapitalForm, setShowCapitalForm] = useState(false);
  const addCapital = useMutation({
    mutationFn: async (body) => unwrap(api.post("/finance/capital", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      setShowCapitalForm(false);
      setCapitalForm({ amountRupees: "", date: today(), source: "", reference: "" });
      toast.success(`Capital added to ${siteName(site)}.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save capital."),
  });

  // --- Reverse site transaction ---
  const reverseTransaction = useMutation({
    mutationFn: async (id) => unwrap(api.post(`/finance/transactions/${id}/reverse`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Transaction reversed. An opposite entry was recorded.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reverse."),
  });

  // --- Company expense ---
  const [ceForm, setCeForm] = useState({ category: "", amountRupees: "", date: today(), description: "", paidTo: "", reference: "" });
  const [showCeForm, setShowCeForm] = useState(false);
  const addCompanyExpense = useMutation({
    mutationFn: async (body) => unwrap(api.post("/finance/company-expenses", body)),
    onSuccess: (_d, body) => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      setShowCeForm(false);
      setCeForm({ category: "", amountRupees: "", date: today(), description: "", paidTo: "", reference: "" });
      toast.success(`Company expense of ${formatINR(Number(body.amountRupees))} recorded.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save company expense."),
  });
  const reverseCompanyExpense = useMutation({
    mutationFn: async (id) => unwrap(api.post(`/finance/company-expenses/${id}/reverse`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Company expense reversed.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reverse."),
  });

  const reversedInvestmentIds = new Set((investments ?? []).filter((i) => i.reversalOf).map((i) => String(i.reversalOf)));
  const reversedTransactionIds = new Set((transactions ?? []).filter((t) => t.reversalOf).map((t) => String(t.reversalOf)));
  const reversedCeIds = new Set((companyExpenses ?? []).filter((e) => e.reversalOf).map((e) => String(e.reversalOf)));

  const transactionColumns = [
    { header: "Date", cell: (t) => formatDate(t.date) },
    { header: "Category", cell: (t) => t.category.replace(/_/g, " "), className: "font-body" },
    { header: "Amount", cell: (t) => formatINR(Math.round(t.amountPaise / 100)) },
    { header: "Description", cell: (t) => (t.reversalOf ? "Reversal entry" : t.description ?? "—"), className: "font-body" },
    {
      header: "", cell: (t) => t.reversalOf || reversedTransactionIds.has(String(t._id)) ? (
        <span className="text-xs uppercase tracking-wide text-graphite-300">reversed</span>
      ) : (
        <button className="text-xs font-medium text-rust hover:underline"
          onClick={(e) => { e.stopPropagation(); if (window.confirm("Reverse this transaction?")) reverseTransaction.mutate(t._id); }}>
          Reverse
        </button>
      )
    },
  ];

  const investmentColumns = [
    { header: "Date", cell: (i) => formatDate(i.date) },
    { header: "Type", cell: (i) => i.type.replace(/_/g, " "), className: "font-body" },
    { header: "Amount", cell: (i) => formatINR(Math.round(i.amountPaise / 100)) },
    { header: "Reference", cell: (i) => i.reference ?? "—", className: "font-body" },
    { header: "Note", cell: (i) => i.reversalOf ? "Reversal entry" : i.note ?? "—", className: "font-body" },
    {
      header: "", cell: (i) => i.reversalOf || reversedInvestmentIds.has(String(i._id)) ? (
        <span className="text-xs uppercase tracking-wide text-graphite-300">reversed</span>
      ) : (
        <button className="text-xs font-medium text-rust hover:underline"
          onClick={(e) => { e.stopPropagation(); if (window.confirm("Reverse this investment?")) reverseInvestment.mutate(i._id); }}>
          Reverse
        </button>
      )
    },
  ];

  const payoutColumns = [
    { header: "Date", cell: (p) => formatDate(p.date) },
    { header: "Type", cell: (p) => p.type.replace("_", " "), className: "font-body" },
    { header: "Worker", cell: (p) => p.workerEmployeeId ?? "—" },
    { header: "Description", cell: (p) => p.description ?? "—", className: "font-body text-xs" },
    { header: "Amount paid", cell: (p) => formatINR(p.amount), className: "text-rust font-mono" },
  ];

  const ceColumns = [
    { header: "Date", cell: (e) => formatDate(e.date) },
    { header: "Category", cell: (e) => e.category.replace(/_/g, " "), className: "font-body" },
    { header: "Paid to", cell: (e) => e.paidTo ?? "—", className: "font-body" },
    { header: "Amount", cell: (e) => formatINR(Math.round(e.amountPaise / 100)), className: "font-mono text-rust" },
    { header: "Description", cell: (e) => e.reversalOf ? "Reversal entry" : (e.description ?? "—"), className: "font-body text-xs" },
    {
      header: "", cell: (e) => e.reversalOf || reversedCeIds.has(String(e._id)) ? (
        <span className="text-xs uppercase tracking-wide text-graphite-300">reversed</span>
      ) : (
        <button className="text-xs font-medium text-rust hover:underline"
          onClick={(ev) => { ev.stopPropagation(); if (window.confirm("Reverse this company expense?")) reverseCompanyExpense.mutate(e._id); }}>
          Reverse
        </button>
      )
    },
  ];

  const categories = tab === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const totals = summary?.totals;
  const siteRows = summary?.sites ?? [];
  const needsSite = tab === "profit-loss" || tab === "income" || tab === "expenses" || tab === "worker-payouts" || tab === "investments";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Finance</h1>
        <p className="text-sm text-graphite-500">Investments, capital, income, expenses, worker payouts, company expenses, budget alerts — per site and company-wide.</p>
      </div>

      {summaryLoading ? (
        <div className="card animate-pulse p-4 text-sm text-graphite-300">Loading company summary…</div>
      ) : totals && (
        <div className="space-y-3">
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Company gross summary — all {totals.siteCount} sites</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Total investment" value={formatINR(totals.totalInvestment)} sublabel="Added by admin" />
            <KpiCard label="Total income" value={formatINR(totals.totalIncome)} tone="positive" />
            <KpiCard label="Total expenses" value={formatINR(totals.totalExpenses)} sublabel={`Incl. labour ${formatINR(totals.totalLabourCost)}`} tone="negative" />
            <KpiCard label="Gross profit / loss" value={formatINR(totals.grossProfitLoss)} sublabel={`Profit ${formatINR(totals.grossProfit)} · Loss ${formatINR(totals.grossLoss)}`} tone={totals.grossProfitLoss >= 0 ? "positive" : "negative"} />
          </div>
          <p className="text-xs text-graphite-500">
            Net position after recovering investments: <span className={cx("font-mono font-medium", totals.netPosition >= 0 ? "text-teal" : "text-rust")}>{formatINR(totals.netPosition)}</span>
          </p>

          <div>
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Per-site profit / loss</p>
            <div className="card overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-steel-200 bg-steel-100/50">
                    {["Site", "Status", "Investment", "Income", "Total expenses", "Profit / Loss", "Net position"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-200">
                  {siteRows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-graphite-500">No sites yet — create a site to start recording finances.</td></tr>
                  )}
                  {siteRows.map((s) => (
                    <tr key={s.siteId} className="transition-colors hover:bg-steel-100/40 cursor-pointer" onClick={() => { setSite(s.siteId); setTab("profit-loss"); }}>
                      <td className="whitespace-nowrap px-4 py-3"><span className="font-medium text-graphite-900">{s.siteName}</span> <span className="text-xs text-graphite-300">({s.siteCode})</span></td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 font-mono tabular-nums">{formatINR(s.investment)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-teal">{formatINR(s.income)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-rust">{formatINR(s.totalExpenses)}</td>
                      <td className="px-4 py-3"><PnlValue value={s.profitLoss} /></td>
                      <td className="px-4 py-3"><PnlValue value={s.netPosition} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select className="input max-w-xs" value={site} onChange={(e) => setSite(e.target.value)} disabled={!needsSite && false}>
          <option value="">Select a site…</option>
          {sites?.map((s) => (<option key={s._id} value={s._id}>{s.name} ({s.code})</option>))}
        </select>

        <div className="flex flex-wrap rounded border border-steel-200 bg-surface p-0.5">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded px-2.5 py-1.5 text-xs transition-colors ${tab === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`}>
              {tabLabel(t)}
            </button>
          ))}
        </div>

        {(tab === "income" || tab === "expenses") && site && (
          <button className="btn-accent ml-auto" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : `Record ${tab}`}</button>
        )}
        {tab === "investments" && site && (
          <button className="btn-accent ml-auto" onClick={() => setShowInvForm((v) => !v)}>{showInvForm ? "Cancel" : "Add investment"}</button>
        )}
        {tab === "company-expenses" && (
          <button className="btn-accent ml-auto" onClick={() => setShowCeForm((v) => !v)}>{showCeForm ? "Cancel" : "Record company expense"}</button>
        )}
      </div>

      {needsSite && !site ? (
        <p className="rounded border border-dashed border-steel-200 p-6 text-center text-sm text-graphite-500">Select a site to view its {tabLabel(tab).toLowerCase()}.</p>
      ) : null}

      {/* ---------- Profit / Loss ---------- */}
      {tab === "profit-loss" && site && profitLoss && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <KpiCard label="Total investment" value={formatINR(profitLoss.investment)} sublabel={`${profitLoss.investmentCount ?? 0} investment(s)`} />
            <KpiCard label="Capital invested" value={formatINR(profitLoss.capitalInvested ?? 0)} />
            <KpiCard label="Income" value={formatINR(profitLoss.income)} tone="positive" />
            <KpiCard label="Labour cost" value={formatINR(profitLoss.labourCost)} tone="negative" />
            <KpiCard label="Material & other expenses" value={formatINR(profitLoss.materialAndOtherExpenses)} tone="negative" />
            <KpiCard label="Total expenses" value={formatINR(profitLoss.totalExpenses)} tone="negative" />
            <KpiCard label="Profit / Loss" value={formatINR(profitLoss.profitLoss)} sublabel={`Net position: ${formatINR(profitLoss.netPosition)}`} tone={profitLoss.profitLoss >= 0 ? "positive" : "negative"} />
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Capital</p>
              <button className="btn-ghost !py-1 text-xs" onClick={() => setShowCapitalForm((v) => !v)}>{showCapitalForm ? "Cancel" : "Add capital"}</button>
            </div>
            {showCapitalForm && (
              <form className="mt-3 grid grid-cols-4 gap-3" onSubmit={(e) => {
                e.preventDefault();
                addCapital.mutate({ siteId: site, amountRupees: Number(capitalForm.amountRupees), source: capitalForm.source, date: capitalForm.date, reference: capitalForm.reference || undefined });
              }}>
                <input className="input" type="number" min="1" placeholder="Amount (₹)" required value={capitalForm.amountRupees} onChange={(e) => setCapitalForm({ ...capitalForm, amountRupees: e.target.value })} />
                <input className="input" placeholder="Source (Owner, Bank)" required value={capitalForm.source} onChange={(e) => setCapitalForm({ ...capitalForm, source: e.target.value })} />
                <input type="date" className="input" required value={capitalForm.date} onChange={(e) => setCapitalForm({ ...capitalForm, date: e.target.value })} />
                <input className="input" placeholder="Reference" value={capitalForm.reference} onChange={(e) => setCapitalForm({ ...capitalForm, reference: e.target.value })} />
                <button type="submit" className="btn-primary col-span-4 w-fit" disabled={addCapital.isPending}>{addCapital.isPending ? "Saving…" : "Save capital"}</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ---------- Investments ---------- */}
      {tab === "investments" && site && (
        <>
          {showInvForm && (
            <form className="card grid grid-cols-5 gap-3 p-4" onSubmit={(e) => { e.preventDefault(); addInvestment.mutate({ siteId: site, type: invForm.type, amountRupees: Number(invForm.amountRupees), date: invForm.date, reference: invForm.reference || undefined, note: invForm.note || undefined }); }}>
              <select className="input" value={invForm.type} onChange={(e) => setInvForm({ ...invForm, type: e.target.value })}>
                {INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <input className="input" type="number" min="1" placeholder="Amount (₹)" required value={invForm.amountRupees} onChange={(e) => setInvForm({ ...invForm, amountRupees: e.target.value })} />
              <input type="date" className="input" required value={invForm.date} onChange={(e) => setInvForm({ ...invForm, date: e.target.value })} />
              <input className="input" placeholder="Reference" value={invForm.reference} onChange={(e) => setInvForm({ ...invForm, reference: e.target.value })} />
              <input className="input" placeholder="Note" value={invForm.note} onChange={(e) => setInvForm({ ...invForm, note: e.target.value })} />
              <button type="submit" className="btn-primary col-span-5 w-fit" disabled={addInvestment.isPending}>{addInvestment.isPending ? "Saving…" : "Save investment"}</button>
            </form>
          )}
          <DataTable columns={investmentColumns} rows={investments} isLoading={investmentsLoading} emptyTitle="No investments" emptyBody="Add money/material the admin has put into this site." />
        </>
      )}

      {/* ---------- Income / Expenses ---------- */}
      {(tab === "income" || tab === "expenses") && site && (
        <>
          {showForm && (
            <form className="card grid grid-cols-4 gap-3 p-4" onSubmit={(e) => { e.preventDefault(); record.mutate({ tab, body: { siteId: site, category: form.category, amountRupees: Number(form.amountRupees), date: form.date, description: form.description || undefined } }); }}>
              <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Category…</option>
                {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
              <input className="input" type="number" placeholder="Amount (₹)" required value={form.amountRupees} onChange={(e) => setForm({ ...form, amountRupees: e.target.value })} />
              <input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <button type="submit" className="btn-primary col-span-4 w-fit" disabled={record.isPending}>Save</button>
            </form>
          )}
          <DataTable columns={transactionColumns} rows={transactions} isLoading={isLoading} emptyTitle={`No ${tab}`} emptyBody={`Record the first ${tab} entry for this site.`} />
          <p className="text-xs text-graphite-400">&ldquo;Reverse&rdquo; posts an opposite entry so records stay immutable.</p>
        </>
      )}

      {/* ---------- Worker payouts (cash flow) ---------- */}
      {tab === "worker-payouts" && site && cashFlow && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <KpiCard label="Advances paid out" value={formatINR(cashFlow.advancePaid)} tone="negative" />
            <KpiCard label="Kharchi paid out" value={formatINR(cashFlow.kharchiPaid)} tone="negative" />
            <KpiCard label="Total cash to workers" value={formatINR(cashFlow.totalPayoutToWorkers)} tone="negative" />
          </div>
          <p className="text-xs text-graphite-500">These are actual cash payouts (advances & kharchi paid out on site) — separate from accrued labour cost in the P/L view. When salaries are paid at month end, settled amounts are reduced by these already-paid advances.</p>
          <DataTable columns={payoutColumns} rows={cashFlow.payouts} emptyTitle="No worker payouts recorded" emptyBody="When you mark advances PAID or approve kharchi, they appear here as cash outflows." />
        </div>
      )}

      {/* ---------- Company expenses ---------- */}
      {tab === "company-expenses" && (
        <>
          {showCeForm && (
            <form className="card grid grid-cols-4 gap-3 p-4" onSubmit={(e) => { e.preventDefault(); addCompanyExpense.mutate({ category: ceForm.category, amountRupees: Number(ceForm.amountRupees), date: ceForm.date, description: ceForm.description || undefined, paidTo: ceForm.paidTo || undefined, reference: ceForm.reference || undefined }); }}>
              <select className="input" required value={ceForm.category} onChange={(e) => setCeForm({ ...ceForm, category: e.target.value })}>
                <option value="">Category…</option>
                {COMPANY_EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
              <input className="input" type="number" min="1" placeholder="Amount (₹)" required value={ceForm.amountRupees} onChange={(e) => setCeForm({ ...ceForm, amountRupees: e.target.value })} />
              <input type="date" className="input" required value={ceForm.date} onChange={(e) => setCeForm({ ...ceForm, date: e.target.value })} />
              <input className="input" placeholder="Paid to" value={ceForm.paidTo} onChange={(e) => setCeForm({ ...ceForm, paidTo: e.target.value })} />
              <input className="input col-span-2" placeholder="Description" value={ceForm.description} onChange={(e) => setCeForm({ ...ceForm, description: e.target.value })} />
              <input className="input col-span-2" placeholder="Reference (receipt #)" value={ceForm.reference} onChange={(e) => setCeForm({ ...ceForm, reference: e.target.value })} />
              <button type="submit" className="btn-primary col-span-4 w-fit" disabled={addCompanyExpense.isPending}>{addCompanyExpense.isPending ? "Saving…" : "Save company expense"}</button>
            </form>
          )}
          <DataTable columns={ceColumns} rows={companyExpenses} isLoading={ceLoading} emptyTitle="No company expenses" emptyBody="Record office/admin expenses here (rent, utilities, office salaries, etc)." />
        </>
      )}

      {/* ---------- Budget alerts ---------- */}
      {tab === "budget-alerts" && (
        <div className="space-y-3">
          <p className="text-sm text-graphite-500">Set a budget on any site (edit site details) to track utilization. Sites at 80%+ show a warning; at 100%+ show over budget.</p>
          {(!budgetAlerts || budgetAlerts.length === 0) ? (
            <div className="card p-6 text-center text-sm text-graphite-500">No budgets set yet — open Sites → Details → Edit to set a budget on a site.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-steel-200 bg-steel-100/50">
                    {["Site", "Budget", "Spent", "Utilization", "Status"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-graphite-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-200">
                  {budgetAlerts.map((a) => (
                    <tr key={a.siteId}>
                      <td className="px-4 py-3"><span className="font-medium">{a.siteName}</span> <span className="text-xs text-graphite-300">({a.siteCode})</span></td>
                      <td className="px-4 py-3 font-mono">{formatINR(a.budgetRupees)}</td>
                      <td className="px-4 py-3 font-mono text-rust">{formatINR(a.spentRupees)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 rounded-full bg-steel-100">
                            <div className={cx("h-2 rounded-full", a.level === "OVER_BUDGET" ? "bg-rust" : a.level === "WARNING" ? "bg-amber-500" : "bg-teal")} style={{ width: `${Math.min(a.utilizationPct, 100)}%` }} />
                          </div>
                          <span className="text-xs font-mono">{a.utilizationPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cx("badge",
                          a.level === "OVER_BUDGET" ? "bg-rust-50 text-rust" :
                          a.level === "WARNING" ? "bg-amber-50 text-amber-600" :
                          "bg-teal-50 text-teal"
                        )}>{a.level.replace("_", " ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
