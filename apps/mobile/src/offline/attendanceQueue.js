import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "@/lib/apiClient";

const QUEUE_KEY = "ananta_offline_attendance_queue";

async function readQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const OfflineAttendanceQueue = {
  /**
   * Enqueues an attendance action. Does NOT claim it's synced — the caller
   * must show a "pending sync" indicator until syncPending() confirms
   * server acknowledgment, per spec §45 ("do not claim data is synchronized
   * until server confirmation").
   */
  async enqueue(action) {
    const queue = await readQueue();
    const entry = {
      ...action,
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      queuedAt: new Date().toISOString(),
      syncStatus: "PENDING"
    };
    queue.push(entry);
    await writeQueue(queue);
    return entry;
  },

  async getQueue() {
    return readQueue();
  },

  async getPendingCount() {
    const queue = await readQueue();
    return queue.filter((a) => a.syncStatus !== "SYNCING").length;
  },

  /**
   * Attempts to sync every pending action. Successful ones are removed;
   * failed ones (validation errors, duplicate-attendance conflicts, etc.)
   * stay in the queue marked FAILED with the server's error message so the
   * manager can see what needs manual attention rather than silently retrying forever.
   */
  async syncPending() {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return { synced: 0, failed: 0 };

    let queue = await readQueue();
    let synced = 0;
    let failed = 0;

    for (const action of queue) {
      if (action.syncStatus === "SYNCING") continue;
      try {
        await api.post("/attendance", {
          worker: action.worker,
          site: action.site,
          date: action.date,
          status: action.status,
          hoursWorked: action.hoursWorked,
          overtimeHours: action.overtimeHours
        });
        synced++;
        queue = queue.filter((a) => a.localId !== action.localId);
        await writeQueue(queue);
      } catch (err) {
        failed++;
        queue = queue.map((a) =>
        a.localId === action.localId ?
        { ...a, syncStatus: "FAILED", errorMessage: err instanceof Error ? err.message : "Sync failed" } :
        a
        );
        await writeQueue(queue);
      }
    }

    return { synced, failed };
  },

  async removeFailed(localId) {
    const queue = await readQueue();
    await writeQueue(queue.filter((a) => a.localId !== localId));
  },

  subscribeToConnectivity(onReconnect) {
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!state.isConnected) {
        wasOffline = true;
      } else if (wasOffline) {
        wasOffline = false;
        onReconnect();
      }
    });
    return unsubscribe;
  }
};