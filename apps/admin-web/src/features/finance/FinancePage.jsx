import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, formatDate, cx } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const EXPENSE_CATEGORIES = ["MATERIAL", "LABOUR", "TRANSPORT", "EQUIPMENT", "ELECTRICITY", "RENT", "FOOD", "MAINTENANCE", "VENDOR_PAYMENT", "OTHER"];
const INCOME_CATEGORIES = ["CLIENT_PAYMENT", "CONTRACT_PAYMENT", "MILESTONE_PAYMENT", "OTHER"];
const INVESTMENT_TYPES = ["CASH", "MATERIAL", "EQUIPMENT", "LABOUR_ADVANCE", "OTHER"];
const TABS = ["profit-loss", "income", "expenses", "investments"];

const today = () => new Date().toISOString().slice(0, 10);

/** Signed rupee figure with profit/loss colouring. */
function PnlValue({ value }) {
  const profit = value >= 0;
  return (
    <span className={cx("font-mono font-medium tabular-nums", profit ? "text-teal" : "text-rust")}>
      {formatINR(value)}
      {!profit && <span className="ml-1 text-xs uppercase">loss</span>}
    </span>
  );
}

export function FinancePage() {
  const [searchParams] = useSearchParams();
  // Dashboard KPI cards link here with ?tab=income|expenses|profit-loss and
  // ?scope=company so the page opens already showing the relevant detail
  // instead of a blank site picker.
  const requestedTab = searchParams.get("tab") ?? "profit-loss";
  const initialTab = TABS.includes(requestedTab) ? requestedTab : "profit-loss";
  const companyScope = searchParams.get("scope") === "company";

  const [tab, setTab] = useState(initialTab);
  const [site, setSite] = useState("");
  const qc = useQueryClient();

  // GROSS SUMMARY — company-wide totals + per-site rows (investment, income,
  // expenses, profit/loss per site). Always loaded so the gross figure and
  // the all-sites table are visible without picking a site first.
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["finance", "summary"],
    queryFn: async () => unwrap(api.get("/finance/summary"))
  });

  const { data: companyPnl } = useQuery({
    queryKey: ["finance", "company-profit-loss"],
    queryFn: async () => unwrap(api.get("/finance/company/profit-loss")),
    enabled: companyScope
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: async () => unwrap(api.get("/sites"))
  });

  const { data: profitLoss } = useQuery({
    queryKey: ["finance", "site-pnl", site],
    queryFn: async () => unwrap(api.get(`/finance/site/${site}/profit-loss`)),
    enabled: Boolean(site) && tab === "profit-loss"
  });

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["finance", tab, site],
    queryFn: async () => unwrap(api.get(`/finance/${tab}?site=${site}`)),
    enabled: Boolean(site) && (tab === "income" || tab === "expenses")
  });

  const { data: investments, isLoading: investmentsLoading } = useQuery({
    queryKey: ["finance", "investments", site],
    queryFn: async () => unwrap(api.get(`/finance/investments?site=${site}`)),
    enabled: Boolean(site) && tab === "investments"
  });

  useSocketInvalidate("site:income_added", [["finance"]]);
  useSocketInvalidate("site:expense_added", [["finance"]]);
  useSocketInvalidate("site:investment_added", [["finance"]]);
  useSocketInvalidate("site:investment_reversed", [["finance"]]);
  useSocketInvalidate("site:profit_updated", [["finance"]]);

  const [form, setForm] = useState({ category: "", amountRupees: "", date: today(), description: "" });
  const [showForm, setShowForm] = useState(false);

  const record = useMutation({
    mutationFn: async () =>
    unwrap(
      api.post(`/finance/${tab}`, {
        siteId: site,
        category: form.category,
        amountRupees: Number(form.amountRupees),
        date: form.date,
        description: form.description || undefined
      })
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      setShowForm(false);
      setForm({ category: "", amountRupees: "", date: today(), description: "" });
    }
  });

  // --- Add investment (per site) -----------------------------------------
  const [invForm, setInvForm] = useState({ type: "CASH", amountRupees: "", date: today(), reference: "", note: "" });
  const [showInvForm, setShowInvForm] = useState(false);

  const addInvestment = useMutation({
    mutationFn: async () =>
    unwrap(
      api.post("/finance/investments", {
        siteId: site,
        amountRupees: Number(invForm.amountRupees),
        type: invForm.type,
        date: invForm.date,
        reference: invForm.reference || undefined,
        note: invForm.note || undefined
      })
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      setShowInvForm(false);
      setInvForm({ type: "CASH", amountRupees: "", date: today(), reference: "", note: "" });
    }
  });

  const reverseInvestment = useMutation({
    mutationFn: async (investmentId) => unwrap(api.post(`/finance/investments/${investmentId}/reverse`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] })
  });

  const transactionColumns = [
  { header: "Date", cell: (t) => formatDate(t.date) },
  { header: "Category", cell: (t) => t.category.replace(/_/g, " "), className: "font-body" },
  { header: "Amount", cell: (t) => formatINR(Math.round(t.amountPaise / 100)) },
  { header: "Description", cell: (t) => t.description ?? "—", className: "font-body" }];

  // An original investment that already has a reversal entry can't be reversed again.
  const reversedIds = new Set((investments ?? []).filter((i) => i.reversalOf).map((i) => String(i.reversalOf)));
  const investmentColumns = [
  { header: "Date", cell: (i) => formatDate(i.date) },
  { header: "Type", cell: (i) => i.type.replace(/_/g, " "), className: "font-body" },
  { header: "Amount", cell: (i) => formatINR(Math.round(i.amountPaise / 100)) },
  { header: "Reference", cell: (i) => i.reference ?? "—", className: "font-body" },
  { header: "Note", cell: (i) => (i.reversalOf ? "Reversal entry" : i.note ?? "—"), className: "font-body" },
  {
    header: "",
    cell: (i) =>
    i.reversalOf ?
    <span className="text-xs uppercase tracking-wide text-graphite-300">reversed</span> :
    reversedIds.has(String(i._id)) ?
    <span className="text-xs uppercase tracking-wide text-graphite-300">reversed</span> :
    <button
      className="text-xs font-medium text-rust hover:underline disabled:opacity-50"
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm("Reverse this investment? A reversal entry will be recorded.")) {
          reverseInvestment.mutate(i._id);
        }
      }}
      disabled={reverseInvestment.isPending}>

        Reverse
      </button>
  }];

  const categories = tab === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const totals = summary?.totals;
  const siteRows = summary?.sites ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Finance</h1>
        <p className="text-sm text-graphite-500">
          Investments, income, expenses, and profit/loss — per site and company-wide gross.
        </p>
      </div>

      {companyScope && companyPnl &&
      <div>
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
            Company-wide (all sites)
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Total income" value={formatINR(companyPnl.totalIncome)} tone="positive" />
            <KpiCard label="Total labour cost" value={formatINR(companyPnl.totalLabourCost)} tone="negative" />
            <KpiCard label="Total other expenses" value={formatINR(companyPnl.totalOtherExpenses)} tone="negative" />
            <KpiCard
            label="Net profit / loss"
            value={formatINR(companyPnl.totalProfit - companyPnl.totalLoss)}
            tone={companyPnl.totalProfit - companyPnl.totalLoss >= 0 ? "positive" : "negative"} />
          
          </div>
          <p className="mt-2 text-xs text-graphite-500">
            Select a site below to see its individual income, expenses, and transaction history.
          </p>
        </div>
      }

      {/* ---- Gross summary + per-site profit/loss (always visible) ---- */}
      {summaryLoading ?
      <div className="card animate-pulse p-4 text-sm text-graphite-300">Loading company summary…</div> :
      totals &&
      <div className="space-y-3">
          <div>
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
              Company gross summary — all {totals.siteCount} sites
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard label="Total investment" value={formatINR(totals.totalInvestment)} sublabel="Added by admin" />
              <KpiCard label="Total income" value={formatINR(totals.totalIncome)} tone="positive" />
              <KpiCard
              label="Total expenses"
              value={formatINR(totals.totalExpenses)}
              sublabel={`Incl. labour ${formatINR(totals.totalLabourCost)}`}
              tone="negative" />
              <KpiCard
              label="Gross profit / loss"
              value={formatINR(totals.grossProfitLoss)}
              sublabel={`Profit ${formatINR(totals.grossProfit)} · Loss ${formatINR(totals.grossLoss)}`}
              tone={totals.grossProfitLoss >= 0 ? "positive" : "negative"} />
          
            </div>
            <p className="mt-2 text-xs text-graphite-500">
              Net position after recovering investments:{" "}
              <span className={cx("font-mono font-medium", totals.netPosition >= 0 ? "text-teal" : "text-rust")}>
                {formatINR(totals.netPosition)}
              </span>{" "}
              (income − expenses − investment)
            </p>
          </div>

          <div>
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
              Per-site profit / loss
            </p>
            <div className="card overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-steel-200 bg-steel-100/50">
                    {["Site", "Status", "Total investment", "Income", "Total expenses", "Profit / Loss", "Net position"].map((h) =>
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-2.5 text-left font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
                    
                        {h}
                      </th>
                  )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-200">
                  {siteRows.length === 0 &&
                <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-graphite-500">
                        No sites yet — create a site to start recording investments and finances.
                      </td>
                    </tr>
                }
                  {siteRows.map((s) =>
                <tr key={s.siteId} className="transition-colors duration-150 hover:bg-steel-100/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-medium text-graphite-900">{s.siteName}</span>{" "}
                        <span className="text-xs text-graphite-300">({s.siteCode})</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">{formatINR(s.investment)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-teal">{formatINR(s.income)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-rust">{formatINR(s.totalExpenses)}</td>
                      <td className="whitespace-nowrap px-4 py-3"><PnlValue value={s.profitLoss} /></td>
                      <td className="whitespace-nowrap px-4 py-3"><PnlValue value={s.netPosition} /></td>
                    </tr>
                )}
                </tbody>
                {siteRows.length > 0 &&
              <tfoot>
                    <tr className="border-t border-steel-300 bg-steel-100/70 font-semibold">
                      <td className="px-4 py-2.5 text-sm text-graphite-900" colSpan={2}>
                        Gross total (all sites)
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums">{formatINR(totals.totalInvestment)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-teal">{formatINR(totals.totalIncome)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums text-rust">{formatINR(totals.totalExpenses)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5"><PnlValue value={totals.grossProfitLoss} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5"><PnlValue value={totals.netPosition} /></td>
                    </tr>
                  </tfoot>
            }
              </table>
            </div>
          </div>
        </div>
      }

      {/* ---- Per-site detail ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="input max-w-xs" value={site} onChange={(e) => setSite(e.target.value)}>
          <option value="">Select a site…</option>
          {sites?.map((s) =>
          <option key={s._id} value={s._id}>
              {s.name} ({s.code})
            </option>
          )}
        </select>

        <div className="flex rounded border border-steel-200 bg-surface p-0.5">
          {TABS.map((t) =>
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm transition-colors duration-150 ${
            tab === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`
            }>
            
              {t === "profit-loss" ? "Profit / Loss" : t === "investments" ? "Investments" : t === "income" ? "Income" : "Expenses"}
            </button>
          )}
        </div>

        {(tab === "income" || tab === "expenses") && site &&
        <button className="btn-accent ml-auto" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : `Record ${tab === "income" ? "income" : "expense"}`}
          </button>
        }
        {tab === "investments" && site &&
        <button className="btn-accent ml-auto" onClick={() => setShowInvForm((v) => !v)}>
            {showInvForm ? "Cancel" : "Add investment"}
          </button>
        }
      </div>

      {!site ?
      <p className="rounded border border-dashed border-steel-200 p-6 text-center text-sm text-graphite-500">
          Select a site to view and manage its finances.
        </p> :
      tab === "profit-loss" ?
      profitLoss &&
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <KpiCard label="Total investment" value={formatINR(profitLoss.investment)} sublabel={`${profitLoss.investmentCount ?? 0} investment(s) by admin`} />
            <KpiCard label="Income" value={formatINR(profitLoss.income)} tone="positive" />
            <KpiCard label="Labour cost" value={formatINR(profitLoss.labourCost)} tone="negative" />
            <KpiCard label="Material & other expenses" value={formatINR(profitLoss.materialAndOtherExpenses)} tone="negative" />
            <KpiCard
          label="Total expenses"
          value={formatINR(profitLoss.totalExpenses)}
          sublabel="Material + labour"
          tone="negative" />
            <KpiCard
          label="Profit / Loss"
          value={formatINR(profitLoss.profitLoss)}
          sublabel={`Net position after investment: ${formatINR(profitLoss.netPosition)}`}
          tone={profitLoss.profitLoss >= 0 ? "positive" : "negative"} />
        
          </div> :

      tab === "investments" ?
      <>
          {showInvForm &&
        <form
          className="card grid grid-cols-5 gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            addInvestment.mutate();
          }}>
          
              <select className="input" value={invForm.type} onChange={(e) => setInvForm({ ...invForm, type: e.target.value })}>
                {INVESTMENT_TYPES.map((t) =>
            <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
            )}
              </select>
              <input
            className="input"
            type="number"
            min="1"
            placeholder="Amount (₹)"
            required
            value={invForm.amountRupees}
            onChange={(e) => setInvForm({ ...invForm, amountRupees: e.target.value })} />
          
              <input type="date" className="input" required value={invForm.date} onChange={(e) => setInvForm({ ...invForm, date: e.target.value })} />
              <input
            className="input"
            placeholder="Reference (optional)"
            value={invForm.reference}
            onChange={(e) => setInvForm({ ...invForm, reference: e.target.value })} />
          
              <input
            className="input"
            placeholder="Note (optional)"
            value={invForm.note}
            onChange={(e) => setInvForm({ ...invForm, note: e.target.value })} />
          
              <button type="submit" className="btn-primary col-span-5 w-fit" disabled={addInvestment.isPending}>
                {addInvestment.isPending ? "Saving…" : "Save investment"}
              </button>
            </form>
        }

          <DataTable
          columns={investmentColumns}
          rows={investments}
          isLoading={investmentsLoading}
          emptyTitle="No investments recorded"
          emptyBody="Use “Add investment” to record money or material the admin has put into this site." />
        
        </> :

      <>
          {showForm &&
        <form
          className="card grid grid-cols-4 gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            record.mutate();
          }}>
          
              <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Category…</option>
                {categories.map((c) =>
            <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
            )}
              </select>
              <input
            className="input"
            type="number"
            placeholder="Amount (₹)"
            required
            value={form.amountRupees}
            onChange={(e) => setForm({ ...form, amountRupees: e.target.value })} />
          
              <input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input
            className="input"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          
              <button type="submit" className="btn-primary col-span-4 w-fit" disabled={record.isPending}>
                Save
              </button>
            </form>
        }

          <DataTable
          columns={transactionColumns}
          rows={transactions}
          isLoading={isLoading}
          emptyTitle={`No ${tab} recorded`}
          emptyBody={`Record the first ${tab === "income" ? "income entry" : "expense"} for this site.`} />
        
        </>
      }
    </div>);

}
