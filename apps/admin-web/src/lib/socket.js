import { io } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";

let socket = null;

export function getSocket() {
  if (socket) return socket;

  socket = io("/", {
    path: "/socket.io",
    auth: { token: useAuthStore.getState().accessToken },
    autoConnect: true,
    reconnection: true
  });

  useAuthStore.subscribe((state) => {
    if (socket && state.accessToken) {
      socket.auth = { token: state.accessToken };
    }
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}