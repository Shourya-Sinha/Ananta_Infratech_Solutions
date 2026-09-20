import axios from "axios";

import { useAuthStore } from "@/stores/authStore";

export const api = axios.create({ baseURL: "/api/v1", timeout: 20000 });

function getDeviceId() {
  const key = "ananta_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

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
    const res = await axios.post(
      "/api/v1/auth/refresh",
      { refreshToken, deviceId: getDeviceId() }
    );
    if (res.data.success) {
      setTokens(res.data.data.accessToken, res.data.data.refreshToken);
      return res.data.data.accessToken;
    }
    clear();
    return null;
  } catch {
    clear();
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
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

/**
 * Unwraps the {success,data}/{success:false,error} envelope, throwing a readable Error on failure.
 * The thrown Error also carries `code` and `details` from the API envelope so callers can react to
 * specific error kinds (e.g. the worker-registration duplicate warning) instead of just the message.
 */
function enrich(error, envelope) {
  const e = error instanceof Error ? error : new Error(envelope?.message ?? "Request failed");
  e.code = envelope?.code;
  e.details = envelope?.details;
  return e;
}

export async function unwrap(promise) {
  let res;
  try {
    res = await promise;
  } catch (err) {
    const envelope = err?.response?.data?.error;
    throw enrich(err instanceof Error ? err : undefined, envelope);
  }
  if (res.data.success) return res.data.data;
  throw enrich(undefined, res.data.error);
}

export { getDeviceId };