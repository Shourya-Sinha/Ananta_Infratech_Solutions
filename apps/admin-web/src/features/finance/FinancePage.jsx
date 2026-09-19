import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, unwrap } from "@/lib/apiClient";
import { DataTable, KpiCard } from "@/components/ui/DataDisplay";
import { formatINR, formatDate } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

const EXPENSE_CATEGORIES = ["MATERIAL", "LABOUR", "TRANSPORT", "EQUIPMENT", "ELECTRICITY", "RENT", "FOOD", "MAINTENANCE", "VENDOR_PAYMENT", "OTHER"];
const INCOME_CATEGORIES = ["CLIENT_PAYMENT", "CONTRACT_PAYMENT", "MILESTONE_PAYMENT", "OTHER"];

export function FinancePage() {
  const [searchParams] = useSearchParams();
  // Dashboard KPI cards link here with ?tab=income|expenses|profit-loss and
  // ?scope=company so the page opens already showing the relevant detail
  // instead of a blank site picker.
  const initialTab = searchParams.get("tab") ?? "profit-loss";
  const companyScope = searchParams.get("scope") === "company";

  const [tab, setTab] = useState(initialTab);
  const [site, setSite] = useState("");
  const qc = useQueryClient();

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
    enabled: Boolean(site) && tab !== "profit-loss"
  });

  useSocketInvalidate("site:income_added", [["finance"]]);
  useSocketInvalidate("site:expense_added", [["finance"]]);
  useSocketInvalidate("site:profit_updated", [["finance"]]);

  const [form, setForm] = useState({ category: "", amountRupees: "", date: new Date().toISOString().slice(0, 10), description: "" });
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
      setForm({ category: "", amountRupees: "", date: new Date().toISOString().slice(0, 10), description: "" });
    }
  });

  const columns = [
  { header: "Date", cell: (t) => formatDate(t.date) },
  { header: "Category", cell: (t) => t.category.replace(/_/g, " "), className: "font-body" },
  { header: "Amount", cell: (t) => formatINR(Math.round(t.amountPaise / 100)) },
  { header: "Description", cell: (t) => t.description ?? "—", className: "font-body" }];

  const categories = tab === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Finance</h1>
        <p className="text-sm text-graphite-500">Income, expenses, and profit/loss by site.</p>
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
          {["profit-loss", "income", "expenses"].map((t) =>
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm transition-colors duration-150 ${
            tab === t ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`
            }>
            
              {t === "profit-loss" ? "Profit / Loss" : t === "income" ? "Income" : "Expenses"}
            </button>
          )}
        </div>

        {tab !== "profit-loss" && site &&
        <button className="btn-accent ml-auto" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : `Record ${tab === "income" ? "income" : "expense"}`}
          </button>
        }
      </div>

      {!site ?
      <p className="rounded border border-dashed border-steel-200 p-6 text-center text-sm text-graphite-500">
          Select a site to view its finances.
        </p> :
      tab === "profit-loss" ?
      profitLoss &&
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <KpiCard label="Income" value={formatINR(profitLoss.income)} tone="positive" />
            <KpiCard label="Labour cost" value={formatINR(profitLoss.labourCost)} tone="negative" />
            <KpiCard label="Material & other expenses" value={formatINR(profitLoss.materialAndOtherExpenses)} tone="negative" />
            <KpiCard label="Total expenses" value={formatINR(profitLoss.totalExpenses)} tone="negative" />
            <KpiCard label="Capital invested" value={formatINR(profitLoss.capitalInvested)} />
            <KpiCard
          label="Profit / Loss"
          value={formatINR(profitLoss.profitLoss)}
          tone={profitLoss.profitLoss >= 0 ? "positive" : "negative"} />
        
          </div> :

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
          columns={columns}
          rows={transactions}
          isLoading={isLoading}
          emptyTitle={`No ${tab} recorded`}
          emptyBody={`Record the first ${tab === "income" ? "income entry" : "expense"} for this site.`} />
        
        </>
      }
    </div>);

}