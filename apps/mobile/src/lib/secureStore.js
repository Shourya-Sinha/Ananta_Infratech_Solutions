import * as Keychain from "react-native-keychain";

/**
 * Token storage on the device Keychain/Keystore (pure-RN replacement for
 * expo-secure-store). Per spec §8: tokens never go in plain AsyncStorage.
 * Each key gets its own Keychain service entry.
 */
const ACCESS_TOKEN_KEY = "ananta_access_token";
const REFRESH_TOKEN_KEY = "ananta_refresh_token";
const DEVICE_ID_KEY = "ananta_device_id";
const USER_KEY = "ananta_user";

async function getItem(key) {
  const result = await Keychain.getGenericPassword({ service: key });
  return result ? result.password : null;
}

async function setItem(key, value) {
  await Keychain.setGenericPassword(key, value, { service: key });
}

async function deleteItem(key) {
  await Keychain.resetGenericPassword({ service: key });
}

export const SecureTokenStore = {
  async getAccessToken() {
    return getItem(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return getItem(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken, refreshToken) {
    await setItem(ACCESS_TOKEN_KEY, accessToken);
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  async getUser() {
    const raw = await getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async setUser(user) {
    await setItem(USER_KEY, JSON.stringify(user));
  },
  async clear() {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem(USER_KEY);
  },
  async getOrCreateDeviceId() {
    let id = await getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }
};
