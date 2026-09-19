import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { RegisterScreen } from "@/features/auth/RegisterScreen";
import { colors } from "@/theme";

const Stack = createNativeStackNavigator();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerShown: true,
          title: "Create account",
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.graphite900, fontSize: 16, fontWeight: "700" },
          headerTintColor: colors.graphite900,
        }}
      />
    </Stack.Navigator>
  );
}
