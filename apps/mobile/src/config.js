import { RELEASE_VERSION } from "@ananta/constants/src/version";

/**
 * Central app config (pure React Native replacement for expo-constants /
 * app.json `extra`). One place to point the app at a backend:
 *  - Android emulator:  http://10.0.2.2:4000/api/v1   (emulator -> host PC)
 *  - Real phone, Wi-Fi: http://<your-PC-LAN-IP>:4000/api/v1 (e.g. 192.168.1.4)
 *  - Deployed/tunnel:   https://<your-public-api-host>/api/v1
 */
export const API_BASE_URL = "https://matter-scholars-formerly-sentence.trycloudflare.com/api/v1";

/** This build's release version — single source: @ananta/constants. */
export const APP_VERSION = RELEASE_VERSION;
