import { useMutation } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { SecureTokenStore } from "@/lib/secureStore";

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (input) => {
      const deviceId = await SecureTokenStore.getOrCreateDeviceId();
      return unwrap(api.post("/auth/login", { ...input, deviceId }));
    },
    onSuccess: async (data) => {
      if (data.user.role !== "MANAGER" && data.user.role !== "WORKER") {
        throw new Error("This app is for Managers and Workers. Use the Admin Web app instead.");
      }
      await setSession(data.accessToken, data.refreshToken, {
        id: data.user.id,
        name: data.user.name,
        phone: data.user.phone,
        role: data.user.role
      });
    }
  });
}

export function useRegisterStart() {
  return useMutation({
    mutationFn: async (input) => unwrap(api.post("/auth/register/start", input))
  });
}

export function useVerifyRegistrationOtp() {
  return useMutation({
    mutationFn: async ({ phone, otp }) =>
      unwrap(api.post("/auth/otp/verify", { phone, otp, purpose: "REGISTRATION" }))
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: async () => {
      const deviceId = await SecureTokenStore.getOrCreateDeviceId();
      // Best-effort push-token cleanup; logout should still proceed even if
      // this call fails (e.g. already offline).
      await api.delete(`/notifications/push-token/${deviceId}`).catch(() => {});
      return unwrap(api.post("/auth/logout"));
    },
    onSettled: () => clear()
  });
}