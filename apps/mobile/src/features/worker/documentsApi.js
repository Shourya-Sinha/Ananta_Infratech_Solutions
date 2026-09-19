import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";

export function useMyDocuments() {
  return useQuery({
    queryKey: ["worker", "documents"],
    queryFn: async () => unwrap(api.get("/workers/me/documents"))
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const formData = new FormData();
      formData.append("type", input.type);
      // React Native's fetch/FormData accepts this { uri, name, type } shape
      // directly — it is not a standard web File, but RN's networking layer
      // knows how to stream it as multipart form data.
      formData.append("file", {
        uri: input.uri,
        name: input.fileName,
        type: input.mimeType
      });

      return unwrap(
        api.post("/workers/me/documents", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worker", "documents"] })
  });
}