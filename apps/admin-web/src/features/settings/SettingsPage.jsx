import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, unwrap } from "@/lib/apiClient";

export function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "salary-rules"],
    queryFn: async () => unwrap(api.get("/settings/salary-rules"))
  });

  const [form, setForm] = useState({ fullDayHours: 8, overtimeStartHours: 8, overtimeMultiplier: 1 });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const update = useMutation({
    mutationFn: async () => unwrap(api.patch("/settings/salary-rules", form)),
    onSuccess: (updated) => {
      setForm(updated);
      qc.invalidateQueries({ queryKey: ["settings", "salary-rules"] });
    }
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Settings</h1>
        <p className="text-sm text-graphite-500">Payroll rules and system configuration.</p>
      </div>

      <div className="card p-5">
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
          Attendance & overtime rules
        </p>
        <p className="mb-4 text-xs text-graphite-500">
          Applies to every future salary calculation across all sites. Changing these does not retroactively
          recalculate already-finalized payroll months.
        </p>

        {isLoading ?
        <p className="text-sm text-graphite-500">Loading…</p> :

        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}>
          
            <div>
              <label className="mb-1.5 block text-sm font-medium text-graphite-900">Full day hours</label>
              <input
              type="number"
              min={1}
              max={24}
              className="input"
              value={form.fullDayHours}
              onChange={(e) => setForm({ ...form, fullDayHours: Number(e.target.value) })} />
            
              <p className="mt-1 text-xs text-graphite-500">Hours that count as one full working day.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-graphite-900">Overtime starts after</label>
              <input
              type="number"
              min={1}
              max={24}
              className="input"
              value={form.overtimeStartHours}
              onChange={(e) => setForm({ ...form, overtimeStartHours: Number(e.target.value) })} />
            
              <p className="mt-1 text-xs text-graphite-500">Hours beyond this are paid as overtime.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-graphite-900">Overtime multiplier</label>
              <input
              type="number"
              min={0.5}
              max={5}
              step={0.1}
              className="input"
              value={form.overtimeMultiplier}
              onChange={(e) => setForm({ ...form, overtimeMultiplier: Number(e.target.value) })} />
            
              <p className="mt-1 text-xs text-graphite-500">1.0 = straight hourly rate, 1.5 = time-and-a-half.</p>
            </div>

            <div className="col-span-2">
              <button type="submit" className="btn-accent" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save rules"}
              </button>
              {update.isSuccess && <span className="ml-3 text-sm text-teal">Saved.</span>}
            </div>
          </form>
        }
      </div>

      <div className="card p-5">
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
          Work types & daily rates
        </p>
        <p className="mb-3 text-xs text-graphite-500">
          Add work types (Mason, Carpenter, Helper, …) and set each one&apos;s default daily rate.
        </p>
        <Link to="/work-types" className="text-sm font-medium text-amber-600 hover:underline">
          Manage work types →
        </Link>
      </div>

      <div className="card p-5">
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
          Permissions
        </p>
        <p className="mb-3 text-xs text-graphite-500">
          Configure what Manager and Worker roles can do.
        </p>
        <Link to="/permissions" className="text-sm font-medium text-amber-600 hover:underline">
          Open Permission Management →
        </Link>
      </div>
    </div>);

}