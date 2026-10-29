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

const FIELD_LABELS = {
  fullName: "Full name",
  phone: "Mobile number",
  password: "Password",
  confirmPassword: "Confirm password",
  address: "Address",
  email: "Email",
  otp: "OTP",
  amount: "Amount",
  reason: "Reason",
  workerId: "Worker",
  workTypeId: "Work type",
  dailyRateRupees: "Per-day wage"
};

function humanizeField(field) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Turn an axios failure into a normal Error carrying the SERVER'S EXACT
 * message. Before this, a 422 surfaced to users as axios's generic
 * "Request failed with status code 422" even though the API had sent
 * the precise reason (e.g. "Enter a valid Indian mobile number").
 * Validation errors are expanded per field; everything else keeps the
 * server's own message (already-registered, wrong OTP, etc.).
 */
export function normalizeApiError(error) {
  if (error instanceof Error && error.code && error.status) return error;
  const data = error?.response?.data;
  const serverError = data?.error;
  const status = error?.response?.status;

  let message;
  if (serverError?.details?.fieldErrors || serverError?.details?.formErrors) {
    const parts = [];
    for (const [field, msgs] of Object.entries(serverError.details.fieldErrors ?? {})) {
      for (const m of msgs ?? []) parts.push(`${humanizeField(field)}: ${m}`);
    }
    for (const m of serverError.details.formErrors ?? []) parts.push(m);
    message = parts.length ? parts.join("\n") : serverError.message;
  } else if (serverError?.message) {
    message = serverError.message;
  } else if (!error?.response) {
    message = "Can't reach the server. Check your internet connection and try again.";
  } else {
    message = error?.message ?? "Something went wrong. Please try again.";
  }

  const err = new Error(message);
  err.code = serverError?.code ?? (status ? `HTTP_${status}` : "NETWORK_ERROR");
  err.status = status;
  err.details = serverError?.details;
  err.fieldErrors = serverError?.details?.fieldErrors;
  return err;
}

export async function unwrap(promise) {
  let res;
  try {
    res = await promise;
  } catch (error) {
    throw normalizeApiError(error);
  }
  if (res.data.success) return res.data.data;
  const error = new Error(res.data.error?.message ?? "Something went wrong. Please try again.");
  error.code = res.data.error?.code;
  throw normalizeApiError(error);
}

export { API_BASE_URL };