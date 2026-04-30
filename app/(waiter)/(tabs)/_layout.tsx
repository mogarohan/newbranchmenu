import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useWaiter } from "../../../context/WaiterContext";

// ─── Ann Sathi Brand Colors ───────────────────────────────────────────────────
const ANN = {
  orange: "#fe9a54",
  red: "#f16b3f",
  blue: "#456aba",
  darkBlue: "#2a4795",
  orangeLight: "#fff4ec",
  redLight: "#fff0eb",
  blueLight: "#eef2fb",
  darkBlueLight: "#e8ecf7",
  textPrimary: "#1e293b",
  textSecondary: "#64748b",
  border: "#e2e8f0",
};
// ─────────────────────────────────────────────────────────────────────────────

export default function WaiterTabLayout() {
  const { token, isReady, ordersReadyCount, alertsCount } = useWaiter();

  if (!isReady) {
    return null;
  }

  if (!token) {
    return <Redirect href="/(waiter)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "rgba(42, 71, 149, 0.1)", // Light blue tint border
          height: Platform.OS === "ios" ? 85 : 65,
          paddingBottom: Platform.OS === "ios" ? 25 : 10,
          paddingTop: 8,
          elevation: 10,
          ...Platform.select({
            web: { boxShadow: "0px -4px 16px rgba(42, 71, 149, 0.06)" } as any,
            default: {
              shadowColor: ANN.darkBlue,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            },
          }),
        },
        tabBarActiveTintColor: ANN.darkBlue, // Orange/Red color for active tab
        tabBarInactiveTintColor: ANN.blue,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "900",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="receipt-long" size={26} color={color} />
          ),
          tabBarBadge:
            ordersReadyCount > 0
              ? ordersReadyCount > 99
                ? "99+"
                : ordersReadyCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: ANN.red, // Orange/Red badge
            color: "#fff",
            fontSize: 10,
            fontWeight: "bold",
          },
        }}
      />
      <Tabs.Screen
        name="tables"
        options={{
          title: "Tables",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="table-restaurant" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => (
            <View>
              <MaterialIcons name="notifications" size={26} color={color} />
              {alertsCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: ANN.red, // Orange/Red alert dot
                    borderWidth: 2,
                    borderColor: "#ffffff",
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="account-circle" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
