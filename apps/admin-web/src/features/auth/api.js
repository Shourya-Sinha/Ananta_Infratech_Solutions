import { useMutation } from "@tanstack/react-query";
import { api, unwrap, getDeviceId } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (input) =>
    unwrap(api.post("/auth/login", { ...input, deviceId: getDeviceId() })),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    }
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: async () => unwrap(api.post("/auth/logout")),
    onSettled: () => clear()
  });
}