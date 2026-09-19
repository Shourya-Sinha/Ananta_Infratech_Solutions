import { View, ActivityIndicator } from "react-native";
import { useMyProfile } from "@/features/worker/api";
import { SelectWorkTypeScreen } from "@/features/worker/SelectWorkTypeScreen";
import { WorkerNavigator } from "./WorkerNavigator";
import { colors } from "@/theme";

/**
 * A self-registered worker has a User account and can log in, but has no
 * WorkerProfile until they pick a work type (spec §7 Step 2). This gate
 * checks for that and shows the onboarding screen instead of the full
 * Worker app until a profile exists.
 */
export function WorkerOnboardingGate() {
  const { data: profile, isLoading, isError } = useMyProfile();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  // GET /workers/me 404s (surfaces as a query error) when no profile exists yet.
  if (isError || !profile) {
    return <SelectWorkTypeScreen />;
  }

  return <WorkerNavigator />;
}
