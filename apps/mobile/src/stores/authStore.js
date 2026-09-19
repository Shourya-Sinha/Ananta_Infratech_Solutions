import { create } from "zustand";
import { SecureTokenStore } from "@/lib/secureStore";

export const useAuthStore = create((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    const [accessToken, refreshToken, user] = await Promise.all([
    SecureTokenStore.getAccessToken(),
    SecureTokenStore.getRefreshToken(),
    SecureTokenStore.getUser()]
    );
    set({ accessToken, refreshToken, user, hydrated: true });
  },

  setSession: async (accessToken, refreshToken, user) => {
    await SecureTokenStore.setTokens(accessToken, refreshToken);
    await SecureTokenStore.setUser(user);
    set({ accessToken, refreshToken, user });
  },

  setTokens: async (accessToken, refreshToken) => {
    await SecureTokenStore.setTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken });
  },

  clear: async () => {
    await SecureTokenStore.clear();
    set({ accessToken: null, refreshToken: null, user: null });
  }
}));