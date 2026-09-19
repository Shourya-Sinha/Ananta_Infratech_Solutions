import * as SecureStore from "expo-secure-store";

// Per spec §8: mobile must use secure storage (SecureStore), never plain
// AsyncStorage, for anything token-related.
const ACCESS_TOKEN_KEY = "ananta_access_token";
const REFRESH_TOKEN_KEY = "ananta_refresh_token";
const DEVICE_ID_KEY = "ananta_device_id";
const USER_KEY = "ananta_user";

export const SecureTokenStore = {
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken, refreshToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },
  async getUser() {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async setUser(user) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
  async getOrCreateDeviceId() {
    let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    }
    return id;
  }
};
