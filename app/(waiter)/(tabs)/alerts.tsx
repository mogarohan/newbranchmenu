import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { WAITER_THEME } from "../../../constants/theme";
import { useWaiter } from "../../../context/WaiterContext";
import { logEvent } from "../../../utils/logger";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface WaiterAlert {
  id: string;
  type: "call_waiter" | "system";
  tableNumber: string | number;
  customerName: string;
  timestamp: Date;
  status: "active" | "resolved";
}

export default function WaiterAlertsScreen() {
  // 🔥 Fetching waiter object along with lastAlertPayload
  const { waiter, lastAlertPayload } = useWaiter();

  const [alerts, setAlerts] = useState<WaiterAlert[]>([]);

  // 1. Reactive Alert Generation with Real Table Numbers and Branch Validation
  useEffect(() => {
    if (lastAlertPayload) {
      // 👇 NEW: Branch Isolation Check
      // If waiter has a branch_id and it doesn't match the event's branch_id, ignore the alert
      if (
        waiter?.branch_id &&
        lastAlertPayload.branch_id !== waiter.branch_id
      ) {
        return;
      }

      setAlerts((prev) => {
        // Prevent duplicate renders by checking the backend Event ID
        const isDuplicate = prev.some((a) => a.id === lastAlertPayload.eventId);
        if (isDuplicate) return prev;

        const newAlert: WaiterAlert = {
          id: lastAlertPayload.eventId,
          type: "call_waiter",
          tableNumber: lastAlertPayload.tableNumber,
          customerName: lastAlertPayload.customerName,
          timestamp: new Date(),
          status: "active",
        };

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        return [newAlert, ...prev];
      });
    }
  }, [lastAlertPayload, waiter?.branch_id]); // Dependency updated

  // 2. Auto-Refresh Wait Timers
  useEffect(() => {
    const interval = setInterval(() => {
      setAlerts((prev) => [...prev]);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleResolveAlert = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    logEvent("INFO", "ALERT_RESOLVED", { alertId: id });
  };

  const getWaitTime = (timestamp: Date) => {
    const diffMins = Math.floor(
      (new Date().getTime() - timestamp.getTime()) / 60000,
    );
    if (diffMins < 1) return "Just now";
    return `${diffMins}m ago`;
  };

  const renderAlertItem = ({ item }: { item: WaiterAlert }) => {
    const isUrgent =
      new Date().getTime() - item.timestamp.getTime() > 5 * 60000;

    return (
      <View style={[styles.alertCard, isUrgent && styles.alertCardUrgent]}>
        <View style={styles.alertIconBox}>
          <MaterialIcons
            name="notifications-active"
            size={28}
            color={isUrgent ? WAITER_THEME.danger : WAITER_THEME.warning}
          />
        </View>

        <View style={styles.alertContent}>
          <Text style={styles.alertTitle}>
            Table {item.tableNumber} needs assistance
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}
          >
            <MaterialIcons
              name="person"
              size={14}
              color={WAITER_THEME.primary}
            />
            <Text
              style={[
                styles.alertTime,
                {
                  color: WAITER_THEME.textPrimary,
                  marginLeft: 4,
                  marginRight: 12,
                  fontWeight: "600",
                },
              ]}
            >
              {item.customerName}
            </Text>
            <MaterialIcons
              name="schedule"
              size={14}
              color={WAITER_THEME.textSecondary}
            />
            <Text style={[styles.alertTime, { marginLeft: 4 }]}>
              {getWaitTime(item.timestamp)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={() => handleResolveAlert(item.id)}
        >
          <MaterialIcons name="check" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {alerts.length} active alert{alerts.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <MaterialIcons
              name="notifications-none"
              size={48}
              color={WAITER_THEME.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>All Quiet</Text>
          <Text style={styles.emptySub}>
            No tables are currently requesting assistance.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WAITER_THEME.backgroundLight,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 16,
    backgroundColor: WAITER_THEME.cardBgLight,
    borderBottomWidth: 1,
    borderBottomColor: WAITER_THEME.ui.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: WAITER_THEME.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: WAITER_THEME.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0,0,0,0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: WAITER_THEME.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: WAITER_THEME.textSecondary,
    textAlign: "center",
  },
  listContent: { padding: 16, paddingBottom: 100 },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WAITER_THEME.cardBgLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: WAITER_THEME.ui.border,
    borderLeftWidth: 4,
    borderLeftColor: WAITER_THEME.warning,
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.04)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  alertCardUrgent: {
    borderLeftColor: WAITER_THEME.danger,
    backgroundColor: "#FEF2F2",
  },
  alertIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: WAITER_THEME.textPrimary,
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 13,
    color: WAITER_THEME.textSecondary,
    fontWeight: "500",
  },
  resolveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: WAITER_THEME.success,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
});
