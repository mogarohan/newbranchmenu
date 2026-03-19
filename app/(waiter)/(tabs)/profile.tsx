import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router"; // 👈 useFocusEffect add kiya gaya hai
import React, { useCallback, useState } from "react"; // 👈 hooks add kiye gaye hain
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WAITER_THEME } from "../../../constants/theme";
import { useWaiter } from "../../../context/WaiterContext";
import api from "../../../services/api"; // 👈 API service import kiya gaya hai

export default function WaiterProfileScreen() {
  const { waiter, shiftActive, toggleShift, logout, socketConnected, setWaiter } =
    useWaiter();
  
  const [isRefreshing, setIsRefreshing] = useState(false); // 👈 Loading state for stats update

  // 🔥 BACKEND SE LATEST STATS FETCH KARNE KA FUNCTION
  const refreshProfileStats = useCallback(async () => {
    try {
      setIsRefreshing(true);
      // Backend route: /waiter/profile jo database se taza total_served laayega
      const response = await api.get("/waiter/profile"); 
      if (response.data) {
        setWaiter(response.data); // Context state ko naye data se update kar rahe hain
      }
    } catch (error) {
      console.log("Profile stats refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [setWaiter]);

  // 🔥 JAB BHI USER IS SCREEN PAR AAYEGA, DATA AUTO REFRESH HOGA
  useFocusEffect(
    useCallback(() => {
      refreshProfileStats();
    }, [refreshProfileStats])
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        {/* Manual Refresh Button */}
        <TouchableOpacity onPress={refreshProfileStats} disabled={isRefreshing}>
          {isRefreshing ? (
            <ActivityIndicator size="small" color={WAITER_THEME.primary} />
          ) : (
            <MaterialIcons name="refresh" size={24} color={WAITER_THEME.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Identity Card */}
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

        {/* --- Performance Stats Section (Tables Served) --- */}
        <Text style={styles.sectionHeader}>Service Performance</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Lifetime Tables Served</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="restaurant" size={24} color={WAITER_THEME.primary} />
              {/* 🔥 BACKEND SE FETCHED total_served YAHAN SHOW HOGA */}
              <Text style={styles.statValue}>{waiter?.total_served ?? "0"}</Text> 
            </View>
          </View>
        </View>

        {/* Shift Management Section */}
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
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  },
                ]}
              >
                <MaterialIcons
                  name={shiftActive ? "work" : "bedtime"}
                  size={24}
                  color={
                    shiftActive ? WAITER_THEME.success : WAITER_THEME.danger
                  }
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
                false: WAITER_THEME.ui.border,
                true: WAITER_THEME.success,
              }}
              thumbColor={
                Platform.OS === "ios"
                  ? "#fff"
                  : shiftActive
                    ? "#fff"
                    : "#f4f3f4"
              }
              ios_backgroundColor={WAITER_THEME.ui.border}
            />
          </View>
        </View>

        {/* Connection Diagnostics */}
        <Text style={styles.sectionHeader}>System Diagnostics</Text>
        <View style={styles.controlCard}>
          <View style={styles.diagnosticRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <MaterialIcons
                name="wifi"
                size={20}
                color={WAITER_THEME.textSecondary}
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
                    backgroundColor: socketConnected
                      ? WAITER_THEME.success
                      : WAITER_THEME.danger,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color: socketConnected
                      ? WAITER_THEME.success
                      : WAITER_THEME.danger,
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
                color={WAITER_THEME.textSecondary}
              />
              <Text style={styles.diagnosticText}>Restaurant ID</Text>
            </View>
            <Text style={styles.diagnosticValue}>
              #{waiter?.restaurant_id || "---"}
            </Text>
          </View>
        </View>

        {/* Logout Action */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={WAITER_THEME.danger} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>TechStrota POS v1.0.0</Text>
      </ScrollView>
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
  scrollContent: { padding: 20, paddingBottom: 100 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WAITER_THEME.cardBgLight,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: WAITER_THEME.ui.border,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: WAITER_THEME.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  profileInfo: { flex: 1, alignItems: "flex-start" },
  waiterName: {
    fontSize: 20,
    fontWeight: "bold",
    color: WAITER_THEME.textPrimary,
    marginBottom: 2,
  },
  waiterId: {
    fontSize: 14,
    color: WAITER_THEME.textSecondary,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: WAITER_THEME.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "900",
    color: WAITER_THEME.primary,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: WAITER_THEME.textSecondary,
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: WAITER_THEME.cardBgLight,
    borderRadius: 16,
    paddingVertical: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: WAITER_THEME.ui.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: WAITER_THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: WAITER_THEME.textPrimary,
  },
  controlCard: {
    backgroundColor: WAITER_THEME.cardBgLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: WAITER_THEME.ui.border,
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
    color: WAITER_THEME.textPrimary,
    marginBottom: 2,
  },
  controlSub: { fontSize: 13, color: WAITER_THEME.textSecondary },
  diagnosticRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  diagnosticText: {
    fontSize: 15,
    fontWeight: "600",
    color: WAITER_THEME.textPrimary,
  },
  diagnosticValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: WAITER_THEME.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: WAITER_THEME.ui.border,
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
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.2)",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  logoutBtnText: {
    color: WAITER_THEME.danger,
    fontSize: 16,
    fontWeight: "bold",
  },
  versionText: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 12,
    color: WAITER_THEME.textSecondary,
    fontWeight: "500",
  },
});