import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { THEME } from "../../constants/theme";
import { useSession } from "../../context/SessionContext";

export default function TabLayout() {
  const { sessionToken, isReady } = useSession();

  // 🔥 Web-Safe Flicker Guard: Wait for context to hydrate
  if (!isReady) {
    return null;
  }

  // Strict Auth Guard
  if (!sessionToken) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSecondary,
        headerShown: false,
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 8 },
      }}
    >
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="menu-book" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="receipt-long" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
