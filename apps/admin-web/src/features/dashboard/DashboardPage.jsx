import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, unwrap } from "@/lib/apiClient";
import { KpiCard } from "@/components/ui/DataDisplay";
import { formatINR } from "@/lib/format";
import { useSocketInvalidate } from "@/hooks/useSocketInvalidate";

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: pnl } = useQuery({
    queryKey: ["finance", "company-profit-loss"],
    queryFn: async () => unwrap(api.get("/finance/company/profit-loss")),
  });

  const { data: summary } = useQuery({
    queryKey: ["finance", "summary"],
    queryFn: async () => unwrap(api.get("/finance/summary")),
  });

  const { data: activeSites } = useQuery({
    queryKey: ["sites", { status: "ACTIVE" }],
    queryFn: async () => unwrap(api.get("/sites?status=ACTIVE")),
  });

  const { data: allSites } = useQuery({
    queryKey: ["sites", "all"],
    queryFn: async () => unwrap(api.get("/sites")),
  });

  const { data: managers } = useQuery({
    queryKey: ["users", "managers-count"],
    queryFn: async () => unwrap(api.get("/users?role=MANAGER&pageSize=1")),
    retry: false,
  });

  const { data: pendingWorkers } = useQuery({
    queryKey: ["workers", { verificationStatus: "PENDING_VERIFICATION" }],
    queryFn: async () => unwrap(api.get("/workers?verificationStatus=PENDING_VERIFICATION&pageSize=1")),
  });

  const { data: activeWorkers } = useQuery({
    queryKey: ["workers", { verificationStatus: "ACTIVE" }],
    queryFn: async () => unwrap(api.get("/workers?verificationStatus=ACTIVE&pageSize=1")),
  });

  const { data: pendingAdvances } = useQuery({
    queryKey: ["advances", { status: "REQUESTED" }],
    queryFn: async () => unwrap(api.get("/advances?status=REQUESTED")),
  });

  const { data: pendingKharchi } = useQuery({
    queryKey: ["kharchi", { status: "REQUESTED" }],
    queryFn: async () => unwrap(api.get("/kharchi?status=REQUESTED")),
  });

  const { data: supportTickets } = useQuery({
    queryKey: ["support", "tickets-count"],
    queryFn: async () => unwrap(api.get("/support/tickets")),
    retry: false,
  });

  useSocketInvalidate("attendance:created", [["finance", "company-profit-loss"]]);
  useSocketInvalidate("site:profit_updated", [["finance", "company-profit-loss"]]);
  useSocketInvalidate("site:created", [["sites"]]);
  useSocketInvalidate("user:created", [["users"]]);
  useSocketInvalidate("advance:created", [["advances"]]);
  useSocketInvalidate("kharchi:created", [["kharchi"]]);
  useSocketInvalidate("worker:created", [["workers"]]);

  const chartData = pnl
    ? [
        { name: "Income", value: pnl.totalIncome },
        { name: "Labour", value: pnl.totalLabourCost },
        { name: "Other Exp.", value: pnl.totalOtherExpenses },
        { name: "Profit", value: pnl.totalProfit },
      ]
    : [];

  const openTickets = supportTickets?.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Dashboard</h1>
        <p className="text-sm text-graphite-500">Company-wide overview, live. Covers sites, workforce, finance & operations.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Active sites" value={String(activeSites?.length ?? "—")} onClick={() => navigate("/sites?status=ACTIVE")} />
        <KpiCard label="Total sites" value={String(allSites?.length ?? "—")} sublabel={`${summary?.totals?.siteCount ?? allSites?.length ?? 0} in system`} onClick={() => navigate("/sites")} />
        <KpiCard label="Active workers" value={String(activeWorkers?.total ?? "—")} onClick={() => navigate("/workers?status=ACTIVE")} />
        <KpiCard label="Pending verification" value={String(pendingWorkers?.total ?? "—")} tone={pendingWorkers && pendingWorkers.total > 0 ? "negative" : "neutral"} onClick={() => navigate("/workers?status=PENDING_VERIFICATION")} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Managers" value={String(managers?.total ?? "—")} sublabel="User accounts" onClick={() => navigate("/users?role=MANAGER")} />
        <KpiCard label="Pending requests" value={String((pendingAdvances?.length ?? 0) + (pendingKharchi?.length ?? 0))} sublabel="Advances + Kharchi" onClick={() => navigate("/requests")} />
        <KpiCard label="Open support" value={String(openTickets)} onClick={() => navigate("/support")} />
        <KpiCard label="Total investment" value={summary ? formatINR(summary.totals.totalInvestment) : "—"} sublabel="Admin capital in sites" onClick={() => navigate("/finance")} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Total income" value={pnl ? formatINR(pnl.totalIncome) : "—"} tone="positive" onClick={() => navigate("/finance?scope=company&tab=income")} />
        <KpiCard label="Total expenses" value={pnl ? formatINR(pnl.totalExpenses) : "—"} tone="negative" onClick={() => navigate("/finance?scope=company&tab=expenses")} />
        <KpiCard label="Company profit / loss" value={pnl ? formatINR(pnl.totalProfit - pnl.totalLoss) : "—"} tone={pnl && pnl.totalProfit - pnl.totalLoss >= 0 ? "positive" : "negative"} onClick={() => navigate("/finance?scope=company&tab=profit-loss")} />
      </div>

      {summary && (
        <div className="card p-4">
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Sites at a glance — budget vs actual</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-steel-200 bg-steel-100/50">
                  {["Site", "Status", "Budget", "Invested", "Income", "Expenses", "P/L"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-200">
                {summary.sites.slice(0, 5).map((s) => (
                  <tr key={s.siteId} className="hover:bg-steel-100/40">
                    <td className="px-3 py-2 text-sm font-medium text-graphite-900">{s.siteName}</td>
                    <td className="px-3 py-2 text-xs">{s.status}</td>
                    <td className="px-3 py-2 font-mono text-xs">—</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatINR(s.investment)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-teal">{formatINR(s.income)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-rust">{formatINR(s.totalExpenses)}</td>
                    <td className={`px-3 py-2 font-mono text-xs ${s.profitLoss >= 0 ? "text-teal" : "text-rust"}`}>{formatINR(s.profitLoss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-graphite-500">
            Showing top 5 sites · <button className="text-amber-600 hover:underline" onClick={() => navigate("/finance")}>View full finance breakdown →</button>
          </p>
        </div>
      )}

      <div className="card p-4">
        <p className="mb-4 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">Income vs. cost breakdown</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D8DEE4" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "Inter" }} stroke="#8D97A3" />
            <YAxis tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} stroke="#8D97A3" />
            <Tooltip formatter={(v) => formatINR(v)} />
            <Bar dataKey="value" fill="#C97A1F" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
