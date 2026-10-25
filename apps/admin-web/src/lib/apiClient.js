import axios from "axios";

import { useAuthStore } from "@/stores/authStore";
import { APP_VERSION, useForceUpdateStore } from "@/lib/version";

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
  // Total version control: every request declares this UI build.
  config.headers["x-client"] = "admin-web";
  config.headers["x-app-version"] = APP_VERSION;
  return config;
});

function handleVersionSignals(responseOrError) {
  const headers = responseOrError?.headers ?? responseOrError?.response?.headers;
  const serverRelease = headers?.["x-release-version"];
  if (serverRelease && serverRelease !== APP_VERSION) {
    useForceUpdateStore.getState().trigger({
      currentVersion: APP_VERSION,
      requiredVersion: serverRelease,
      message: "A new version of the admin panel has been deployed on the server."
    });
  }
  const data = responseOrError?.data ?? responseOrError?.response?.data;
  if (responseOrError?.response?.status === 426 || data?.error?.code === "FORCE_UPDATE") {
    const d = data?.error?.details ?? {};
    useForceUpdateStore.getState().trigger({
      currentVersion: d.currentVersion ?? APP_VERSION,
      requiredVersion: d.requiredVersion ?? serverRelease,
      message: data?.error?.message
    });
  }
}

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
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

/**
 * Unwraps the {success,data}/{success:false,error} envelope, throwing a readable Error on failure.
 * The thrown Error carries the server's message (so toasts/login errors show
 * "Invalid phone or password", not "Request failed with status code 401"),
 * plus `code`/`details` from the envelope (e.g. the worker-registration
 * duplicate warning) and `status`/`response` passthrough for callers that
 * inspect the raw HTTP failure (field errors, API-offline detection).
 */
function enrich(error, envelope, source) {
  const message =
    envelope?.message ||
    (error instanceof Error && error.message ? error.message : undefined) ||
    "Request failed";
  const e = new Error(message);
  e.code = envelope?.code;
  e.details = envelope?.details;
  e.status = source?.response?.status;
  // Keep the axios response/error reachable for specialised handlers.
  e.response = source?.response;
  e.cause = error instanceof Error ? error : undefined;
  return e;
}

export async function unwrap(promise) {
  let res;
  try {
    res = await promise;
  } catch (err) {
    const envelope = err?.response?.data?.error;
    throw enrich(err instanceof Error ? err : undefined, envelope, err);
  }
  if (res.data?.success) return res.data.data;
  throw enrich(undefined, res.data?.error, res);
}

export { getDeviceId };