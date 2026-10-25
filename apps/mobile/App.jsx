import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "@/app/RootNavigator";
import { FinanceSocketSync } from "@/lib/financeSocketSync";
import { ForceUpdateModal } from "@/components/ForceUpdateModal";
import { VersionCheck } from "@/lib/versionCheck";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <FinanceSocketSync />
        <VersionCheck />
        <RootNavigator />
        <ForceUpdateModal />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
