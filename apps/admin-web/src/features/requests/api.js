import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function useAdvances(status, options) {
  const qs = new URLSearchParams(status ? { status } : {}).toString();
  return useQuery({
    queryKey: ["advances", { status }],
    queryFn: async () => unwrap(api.get(`/advances?${qs}`)),
    ...options
  });
}

export function useKharchi(status, options) {
  const qs = new URLSearchParams(status ? { status } : {}).toString();
  return useQuery({
    queryKey: ["kharchi", { status }],
    queryFn: async () => unwrap(api.get(`/kharchi?${qs}`)),
    ...options
  });
}

export function useMarkAdvancePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, siteId }) =>
    unwrap(api.post(`/advances/${id}/mark-paid`, siteId ? { siteId } : {})),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advances"] });
      qc.invalidateQueries({ queryKey: ["salary"] });
      qc.invalidateQueries({ queryKey: ["payroll"] });
    }
  });
}

function useInvalidateRequests() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["advances"] });
    qc.invalidateQueries({ queryKey: ["kharchi"] });
    // Deductions hit the salary ledger → payroll + worker summaries move too.
    qc.invalidateQueries({ queryKey: ["salary"] });
    qc.invalidateQueries({ queryKey: ["payroll"] });
  };
}

/**
 * Super Admin only: add an advance for any worker without a request cycle.
 * The backend auto-approves (and by default marks paid) and posts the salary
 * deduction immediately.
 */
export function useDirectAddAdvance() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/advances/direct", input)),
    onSuccess: invalidate
  });
}

/**
 * Super Admin only: add a Kharchi for any worker without a request cycle.
 * Approval (and therefore the salary deduction) happens in the same step.
 */
export function useDirectAddKharchi() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/kharchi/direct", input)),
    onSuccess: invalidate
  });
}
