import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { THEME } from "../constants/theme";
import { SessionProvider, useSession } from "../context/SessionContext";

function RootLayoutNav() {
  const { isReady } = useSession();

  // Hold at a splash screen until AsyncStorage is fully loaded
  if (!isReady) {
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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootLayoutNav />
    </SessionProvider>
  );
}
