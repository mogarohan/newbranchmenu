import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { WAITER_THEME } from "../../../constants/theme";
import { useWaiter } from "../../../context/WaiterContext";

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
          backgroundColor: WAITER_THEME.cardBgLight,
          borderTopColor: "rgba(255, 105, 51, 0.1)",
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: WAITER_THEME.primary,
        tabBarInactiveTintColor: WAITER_THEME.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="receipt-long" size={24} color={color} />
          ),
          tabBarBadge:
            ordersReadyCount > 0
              ? ordersReadyCount > 99
                ? "99+"
                : ordersReadyCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: WAITER_THEME.primary,
            color: "#fff",
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen
        name="tables"
        options={{
          title: "Tables",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="table-restaurant" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => (
            <View>
              <MaterialIcons name="notifications" size={24} color={color} />
              {alertsCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: WAITER_THEME.primary,
                    borderWidth: 2,
                    borderColor: WAITER_THEME.cardBgLight,
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
            <MaterialIcons name="account-circle" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
