import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

export default function WaiterProfileScreen() {
  const {
    waiter,
    shiftActive,
    toggleShift,
    logout,
    socketConnected,
    refreshProfile,
  } = useWaiter(); // 👈 Added refreshProfile here

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use Context Function to refresh
  const refreshProfileStats = useCallback(async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
  }, [refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshProfileStats();
    }, [refreshProfileStats]),
  );

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) {
        logout().then(() => router.replace("/(waiter)/login" as any));
      }
      return;
    }

    Alert.alert("Log Out", "Are you sure you want to end your session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(waiter)/login" as any);
        },
      },
    ]);
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
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity
            onPress={refreshProfileStats}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={ANN.orange} />
            ) : (
              <View style={styles.refreshIconBox}>
                <MaterialIcons name="refresh" size={22} color={ANN.darkBlue} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {waiter?.name ? waiter.name.charAt(0).toUpperCase() : "W"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.waiterName}>
                {waiter?.name || "Staff Member"}
              </Text>
              <Text style={styles.waiterId}>
                {waiter?.email || waiter?.staff_id || "---"}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {waiter?.role?.toUpperCase() || "WAITER"}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Service Performance</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Lifetime Tables Served</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <MaterialIcons name="restaurant" size={24} color={ANN.orange} />
                {/* Count will update safely now */}
                <Text style={styles.statValue}>
                  {waiter?.total_served ?? "0"}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Shift Management</Text>
          <View style={styles.controlCard}>
            <View style={styles.controlRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: shiftActive
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                    },
                  ]}
                >
                  <MaterialIcons
                    name={shiftActive ? "work" : "bedtime"}
                    size={24}
                    color={shiftActive ? "#10b981" : "#ef4444"}
                  />
                </View>
                <View>
                  <Text style={styles.controlTitle}>Active Shift</Text>
                  <Text style={styles.controlSub}>
                    {shiftActive
                      ? "Receiving live orders & alerts."
                      : "You are currently off duty."}
                  </Text>
                </View>
              </View>
              <Switch
                value={shiftActive}
                onValueChange={toggleShift}
                trackColor={{
                  false: ANN.border,
                  true: "#10b981", // Success Green
                }}
                thumbColor={
                  Platform.OS === "ios"
                    ? "#fff"
                    : shiftActive
                      ? "#fff"
                      : "#f4f3f4"
                }
                ios_backgroundColor={ANN.border}
              />
            </View>
          </View>

          <Text style={styles.sectionHeader}>System Diagnostics</Text>
          <View style={styles.controlCard}>
            <View style={styles.diagnosticRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <MaterialIcons
                  name="wifi"
                  size={20}
                  color={ANN.textSecondary}
                />
                <Text style={styles.diagnosticText}>Server Connection</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: socketConnected
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: socketConnected ? "#10b981" : "#ef4444",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: socketConnected ? "#059669" : "#dc2626",
                    },
                  ]}
                >
                  {socketConnected ? "ONLINE" : "OFFLINE"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.diagnosticRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <MaterialIcons
                  name="storefront"
                  size={20}
                  color={ANN.textSecondary}
                />
                <Text style={styles.diagnosticText}>Restaurant ID</Text>
              </View>
              <Text style={styles.diagnosticValue}>
                #{waiter?.restaurant_id || "---"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#ef4444" />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>
            AnnSathi Waiter App
            <br />
            <br />
            <span> Powered By - TechStrota</span>
          </Text>
        </ScrollView>
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
    opacity: 0.15, // Light doodle watermark effect
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248, 250, 252, 0.85)", // Glass effect opacity
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
  refreshIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ANN.blueLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
  },

  scrollContent: { padding: 20, paddingBottom: 100 },

  // ── PROFILE CARD (GLASS UI) ──
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
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
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ANN.darkBlue,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: { fontSize: 28, fontWeight: "900", color: "#fff" },
  profileInfo: { flex: 1, alignItems: "flex-start" },
  waiterName: {
    fontSize: 20,
    fontWeight: "900",
    color: ANN.darkBlue,
    marginBottom: 2,
  },
  waiterId: {
    fontSize: 14,
    color: ANN.textSecondary,
    marginBottom: 8,
    fontWeight: "500",
  },
  roleBadge: {
    backgroundColor: ANN.orangeLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ANN.orange,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "900",
    color: ANN.red,
    letterSpacing: 0.5,
  },

  sectionHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: ANN.textSecondary,
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
    marginLeft: 4,
  },

  // ── PERFORMANCE STATS (GLASS UI) ──
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    paddingVertical: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
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
  statBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: ANN.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "900",
    color: ANN.darkBlue,
  },

  // ── CONTROLS / DIAGNOSTICS (GLASS UI) ──
  controlCard: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
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
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  controlTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: ANN.textPrimary,
    marginBottom: 2,
  },
  controlSub: { fontSize: 13, color: ANN.textSecondary, fontWeight: "500" },
  diagnosticRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  diagnosticText: {
    fontSize: 15,
    fontWeight: "600",
    color: ANN.textPrimary,
  },
  diagnosticValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: ANN.darkBlue,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(42, 71, 149, 0.1)",
    marginVertical: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: "bold", letterSpacing: 0.5 },

  // ── LOGOUT BUTTON ──
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.2)",
    padding: 16,
    borderRadius: 14,
    marginTop: 16,
    gap: 8,
  },
  logoutBtnText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "bold",
  },
  versionText: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 12,
    color: ANN.textSecondary,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
