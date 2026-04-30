import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useWaiter } from "../../../context/WaiterContext";
import { logEvent } from "../../../utils/logger";

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
};
// ─────────────────────────────────────────────────────────────────────────────

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
  const { waiter, lastAlertPayload } = useWaiter();
  const [alerts, setAlerts] = useState<WaiterAlert[]>([]);

  useEffect(() => {
    if (lastAlertPayload) {
      if (
        waiter?.branch_id &&
        lastAlertPayload.branch_id !== waiter.branch_id
      ) {
        return;
      }

      setAlerts((prev) => {
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
  }, [lastAlertPayload, waiter?.branch_id]);

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
        <View
          style={[styles.alertIconBox, isUrgent && styles.alertIconBoxUrgent]}
        >
          <MaterialIcons
            name="notifications-active"
            size={28}
            color={isUrgent ? ANN.red : ANN.orange}
          />
        </View>

        <View style={styles.alertContent}>
          <Text style={styles.alertTitle}>
            Table {item.tableNumber} needs assistance
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}
          >
            <MaterialIcons name="person" size={14} color={ANN.darkBlue} />
            <Text style={styles.alertCustomer}>{item.customerName}</Text>
            <MaterialIcons name="schedule" size={14} color="#64748b" />
            <Text
              style={[
                styles.alertTime,
                isUrgent && { color: ANN.red, fontWeight: "bold" },
              ]}
            >
              {getWaitTime(item.timestamp)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={() => handleResolveAlert(item.id)}
        >
          <MaterialIcons name="check" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.mainWrapper}>
      {/* ─── BACKGROUND IMAGE & GLASS OVERLAY ─── */}
      <Image
        source={require("../../../assets/images/bg.png")}
        style={styles.bgImage}
      />
      <View style={styles.bgOverlay} />

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
                color={ANN.darkBlue}
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
    </View>
  );
}

const styles = StyleSheet.create({
  // ── BACKGROUND STYLES ──
  mainWrapper: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    opacity: 0.15,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248, 250, 252, 0.85)", // Glass effect
  },

  container: {
    flex: 1,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },

  // ── HEADER ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 16,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42, 71, 149, 0.1)",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: ANN.darkBlue,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "600",
  },

  // ── EMPTY STATE ──
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
    backgroundColor: ANN.blueLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.2)",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: ANN.darkBlue,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
  },

  listContent: { padding: 16, paddingBottom: 100 },

  // ── ALERT CARD (GLASS UI) ──
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
    borderLeftWidth: 5,
    borderLeftColor: ANN.orange,
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
    borderLeftColor: ANN.red,
    backgroundColor: "rgba(255, 240, 235, 0.9)", // Light red/orange tint
    borderColor: "rgba(241, 107, 63, 0.3)",
  },

  alertIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ANN.orangeLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  alertIconBoxUrgent: {
    backgroundColor: "rgba(241, 107, 63, 0.15)",
  },

  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: ANN.darkBlue,
    marginBottom: 6,
  },
  alertCustomer: {
    color: ANN.darkBlue,
    marginLeft: 4,
    marginRight: 12,
    fontWeight: "700",
    fontSize: 13,
  },
  alertTime: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginLeft: 4,
  },

  resolveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10b981", // Success Green
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
});
