import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "@/app/router";
import "@/styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false }
  }
});

// StrictMode double-mounts effects in development. YouTube's IFrame API (and
// the react-youtube / youtube-player wrappers) destroy the player on that
// immediate unmount and the second instance never becomes ready — the video
// sits on "Loading player…" or error 153. Production builds do not do this,
// but local dev is where the toggle player is tested.
ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    {/* Opt into the v7 behaviours early so the dev console stays free of
        React Router future-flag warnings. */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRouter />
    </BrowserRouter>
  </QueryClientProvider>
);