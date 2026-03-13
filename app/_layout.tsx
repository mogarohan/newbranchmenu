import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { ErrorBoundary } from "../components/ErrorBoundary"; // Assuming you created this from Step 8 previously
import { THEME } from "../constants/theme";
import { SessionProvider, useSession } from "../context/SessionContext";
import { WaiterProvider, useWaiter } from "../context/WaiterContext";

function AppHydrationGuard() {
  const { isReady: isCustomerReady } = useSession();
  const { isReady: isWaiterReady } = useWaiter();

  if (!isCustomerReady || !isWaiterReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: THEME.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(waiter)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <WaiterProvider>
          <AppHydrationGuard />
        </WaiterProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
