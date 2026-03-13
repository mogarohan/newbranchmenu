import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WAITER_THEME } from "../../constants/theme";
import { useWaiter } from "../../context/WaiterContext";
import { logEvent } from "../../utils/logger";

export default function WaiterLoginScreen() {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useWaiter();

  const handleLogin = async () => {
    if (loading) return;

    Keyboard.dismiss();

    if (!staffId.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your Staff ID and Password.");
      return;
    }

    setLoading(true);
    try {
      await login(staffId, password);
      router.replace({ pathname: "/(waiter)/(tabs)/orders" });
    } catch (error: any) {
      logEvent("WARN", "WAITER_LOGIN_FAILED", error?.message);

      if (error?.status === 401 || error?.status === 404) {
        Alert.alert("Access Denied", "Invalid Staff ID or Password.");
      } else if (error?.status === 429) {
        Alert.alert(
          "Too Many Attempts",
          "Please wait a minute before trying again.",
        );
      } else {
        Alert.alert(
          "Connection Error",
          "Could not reach the server. Please check your internet.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* 🔥 FIX: Removed TouchableWithoutFeedback and added keyboardShouldPersistTaps */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.backBtn,
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
            ]}
            onPress={() => router.replace("/")}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <View style={styles.logoWrapper}>
              <MaterialIcons
                name="restaurant"
                size={48}
                color={WAITER_THEME.primary}
              />
            </View>
            <Text style={styles.title}>Staff Portal</Text>
            <Text style={styles.subtitle}>
              Sign in to manage orders and tables
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Staff ID</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons
                  name="badge"
                  size={20}
                  color="rgba(255,255,255,0.4)"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your ID"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={staffId}
                  onChangeText={setStaffId}
                  autoCapitalize="none"
                  keyboardType="default"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  style={
                    Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}
                  }
                >
                  <Text style={styles.forgotText}>Forgot ID/Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <MaterialIcons
                  name="lock"
                  size={20}
                  color="rgba(255,255,255,0.4)"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    styles.eyeBtn,
                    Platform.OS === "web" && ({ cursor: "pointer" } as any),
                  ]}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="rgba(255,255,255,0.4)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.loginBtn,
                loading && { opacity: 0.7 },
                Platform.OS === "web" && ({ cursor: "pointer" } as any),
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>LOGIN</Text>
                  <MaterialIcons name="login" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Having trouble logging in?</Text>
            <TouchableOpacity
              style={
                Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}
              }
            >
              <Text style={styles.footerLink}>Contact System Manager</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WAITER_THEME.backgroundDark },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    paddingBottom: 40,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 10,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  headerContainer: { alignItems: "center", marginBottom: 40, marginTop: 40 },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(255, 105, 51, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 105, 51, 0.2)",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.6)" },
  formContainer: { gap: 20 },
  inputGroup: { gap: 8 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginLeft: 4,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  forgotText: { fontSize: 12, fontWeight: "600", color: WAITER_THEME.primary },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    height: 56,
  },
  inputIcon: { paddingHorizontal: 16 },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#ffffff",
    ...((Platform.OS === "web" ? { outlineStyle: "none" } : {}) as any),
  },
  eyeBtn: { paddingHorizontal: 16, height: "100%", justifyContent: "center" },
  loginBtn: {
    backgroundColor: WAITER_THEME.primary,
    height: 56,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: WAITER_THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  footer: { marginTop: 40, alignItems: "center", gap: 6 },
  footerText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
  footerLink: { fontSize: 14, fontWeight: "600", color: WAITER_THEME.primary },
});
