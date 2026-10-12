import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export const cmsKeys = {
  state: ["cms", "state"],
  inquiries: (filters) => ["cms", "inquiries", filters]
};

export function useCmsState() {
  return useQuery({
    queryKey: cmsKeys.state,
    queryFn: async () => unwrap(api.get("/cms")),
    refetchOnWindowFocus: false
  });
}

export function useCmsInquiries(filters) {
  return useQuery({
    queryKey: cmsKeys.inquiries(filters),
    queryFn: async () => {
      const params = {};
      if (filters.kind) params.kind = filters.kind;
      if (filters.status) params.status = filters.status;
      return unwrap(api.get("/cms/inquiries", { params }));
    }
  });
}

export function saveCmsDraft(content) {
  return unwrap(api.put("/cms/draft", { content }));
}

export function publishCmsDraft() {
  return unwrap(api.post("/cms/publish"));
}

export function discardCmsDraft() {
  return unwrap(api.post("/cms/discard"));
}

export function updateInquiryStatus(id, status) {
  return unwrap(api.patch(`/cms/inquiries/${id}`, { status }));
}
