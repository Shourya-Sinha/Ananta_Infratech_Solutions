import axios from "axios";
import Constants from "expo-constants";

import { useAuthStore } from "@/stores/authStore";
import { SecureTokenStore } from "@/lib/secureStore";

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? "http://localhost:4000/api/v1";

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

async function refreshAccessToken() {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const deviceId = await SecureTokenStore.getOrCreateDeviceId();
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken, deviceId }
    );
    if (res.data.success) {
      await setTokens(res.data.data.accessToken, res.data.data.refreshToken);
      return res.data.data.accessToken;
    }
    await clear();
    return null;
  } catch {
    await clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => refreshPromise = null);
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      }
    }

    return Promise.reject(error);
  }
);

export async function unwrap(promise) {
  const res = await promise;
  if (res.data.success) return res.data.data;
  const error = new Error(res.data.error.message);
  error.code = res.data.error.code;
  throw error;
}

export { API_BASE_URL };