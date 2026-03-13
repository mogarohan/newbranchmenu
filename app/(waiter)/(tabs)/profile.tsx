import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
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

export default function WaiterProfileScreen() {
  const { waiter, shiftActive, toggleShift, logout, socketConnected } =
    useWaiter();

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) {
        // 🔥 Use 'as any' to bypass the strict Expo Router type check
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
          // 🔥 Use 'as any' to bypass the strict Expo Router type check
          router.replace("/(waiter)/login" as any);
        },
      },
    ]);
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
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
            {/* 🔥 Tells it to use the email, or fallback to ID if you add one later */}
            <Text style={styles.waiterId}>
              {waiter?.email || waiter?.staff_id || "---"}
            </Text>{" "}
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {waiter?.role?.toUpperCase() || "WAITER"}
              </Text>
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
            {/* 🔥 Crucial for verifying tenant isolation during deployment */}
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
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.03)" } as any,
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
