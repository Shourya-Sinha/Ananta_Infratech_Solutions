import axios from "axios";

import { useAuthStore } from "@/stores/authStore";
import { SecureTokenStore } from "@/lib/secureStore";
import { APP_VERSION, useForceUpdateStore, versionHeaders } from "@/lib/version";
import { API_BASE_URL } from "@/config";

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Total version control: every request declares this app build.
  Object.assign(config.headers, versionHeaders());
  return config;
});

function handleVersionSignals(errorOrResponse) {
  const headers = errorOrResponse?.headers ?? errorOrResponse?.response?.headers;
  const serverRelease = headers?.["x-release-version"];
  if (serverRelease && serverRelease !== APP_VERSION) {
    useForceUpdateStore.getState().trigger({
      currentVersion: APP_VERSION,
      requiredVersion: serverRelease,
      message: "A new version of Ananta Infratech is required to continue."
    });
  }
  const data = errorOrResponse?.data ?? errorOrResponse?.response?.data;
  const status = errorOrResponse?.response?.status ?? errorOrResponse?.status;
  if (status === 426 || data?.error?.code === "FORCE_UPDATE") {
    const d = data?.error?.details ?? {};
    useForceUpdateStore.getState().trigger({
      currentVersion: d.currentVersion ?? APP_VERSION,
      requiredVersion: d.requiredVersion ?? serverRelease,
      updateUrl: d.updateUrl || undefined,
      message: data?.error?.message
    });
  }
}

let refreshPromise = null;

async function refreshAccessToken() {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const deviceId = await SecureTokenStore.getOrCreateDeviceId();
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken, deviceId },
      { headers: versionHeaders() }
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
  (res) => {
    handleVersionSignals(res);
    return res;
  },
  async (error) => {
    handleVersionSignals(error);
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