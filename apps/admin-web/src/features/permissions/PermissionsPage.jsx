import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function PermissionsPage() {
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => unwrap(api.get("/roles"))
  });

  const configurableRoles = (roles ?? []).filter((r) => r.key !== "SUPER_ADMIN");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const activeRoleId = selectedRoleId || configurableRoles[0]?.id || "";
  const qc = useQueryClient();

  const { data: matrix, isLoading } = useQuery({
    queryKey: ["permissions", activeRoleId],
    queryFn: async () => unwrap(api.get(`/permissions/role/${activeRoleId}`)),
    enabled: Boolean(activeRoleId)
  });

  const update = useMutation({
    mutationFn: async (updates) =>
    unwrap(api.patch(`/permissions/role/${activeRoleId}`, { updates })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissions", activeRoleId] })
  });

  const grouped = (matrix ?? []).reduce((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-graphite-900">Permission Management</h1>
        <p className="text-sm text-graphite-500">
          Toggle what each role can do. Super Admin always has full access and cannot be restricted.
        </p>
      </div>

      <div className="flex rounded border border-steel-200 bg-surface p-0.5 w-fit">
        {configurableRoles.map((r) =>
        <button
          key={r.id}
          onClick={() => setSelectedRoleId(r.id)}
          className={`rounded px-3 py-1.5 text-sm transition-colors duration-150 ${
          activeRoleId === r.id ? "bg-graphite-900 text-paper" : "text-graphite-500 hover:bg-steel-100"}`
          }>
          
            {r.label}
          </button>
        )}
      </div>

      {isLoading || !activeRoleId ?
      <p className="text-sm text-graphite-500">Loading…</p> :

      <div className="space-y-4">
          {Object.entries(grouped).map(([group, perms]) =>
        <div key={group} className="card p-4">
              <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-graphite-500">
                {group}
              </p>
              <div className="space-y-2">
                {perms.map((p) =>
            <label key={p.key} className="flex items-center justify-between gap-4 py-1">
                    <span className="text-sm text-graphite-900">
                      {p.description}
                      <span className="ml-2 font-mono text-xs text-graphite-300">{p.key}</span>
                    </span>
                    <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) => update.mutate([{ permissionKey: p.key, enabled: e.target.checked }])}
                className="h-4 w-4 accent-amber" />
              
                  </label>
            )}
              </div>
            </div>
        )}
        </div>
      }
    </div>);

}