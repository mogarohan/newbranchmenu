import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useWaiter } from "../../context/WaiterContext";
import { logEvent } from "../../utils/logger";

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

export default function WaiterLoginScreen() {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 👇 NEW: State to hold the error message to display on UI
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login } = useWaiter();

  const handleLogin = async () => {
    if (loading) return;

    Keyboard.dismiss();
    setErrorMessage(null); // Clear previous errors

    if (!staffId.trim() || !password.trim()) {
      setErrorMessage("Please enter your Waiter ID and Password.");
      return;
    }

    setLoading(true);
    try {
      await login(staffId, password);
      router.replace({ pathname: "/(waiter)/(tabs)/orders" });
    } catch (error: any) {
      logEvent("WARN", "WAITER_LOGIN_FAILED", error?.message);

      // 👇 UPDATED: Show error message directly on the screen instead of Alert
      if (
        error?.status === 401 ||
        error?.status === 404 ||
        error?.message?.toLowerCase().includes("invalid") ||
        error?.message?.toLowerCase().includes("credential")
      ) {
        setErrorMessage("Invalid username and password.");
      } else if (error?.status === 429) {
        setErrorMessage(
          "Too Many Attempts. Please wait a minute before trying again.",
        );
      } else {
        setErrorMessage(
          "Connection Error. Could not reach the server. Please check your internet.",
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Back Button ── */}
          <TouchableOpacity
            style={[
              styles.backBtn,
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
            ]}
            onPress={() => router.replace("/")}
          >
            <MaterialIcons name="arrow-back" size={24} color={ANN.darkBlue} />
          </TouchableOpacity>

          {/* ── Logo & Title ── */}
          <View style={styles.headerContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require("../../assets/images/ann-sathi.png")}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.title}>Waiter Login</Text>
            <Text style={styles.subtitle}>
              Sign in to manage orders and tables
            </Text>
          </View>

          {/* ── Login Form ── */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Waiter ID</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons
                  name="person-outline"
                  size={20}
                  color={ANN.darkBlue}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your ID"
                  placeholderTextColor={ANN.textSecondary}
                  value={staffId}
                  onChangeText={(text) => {
                    setStaffId(text);
                    setErrorMessage(null); // Clear error on typing
                  }}
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
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <MaterialIcons
                  name="lock-outline"
                  size={20}
                  color={ANN.darkBlue}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={ANN.textSecondary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage(null); // Clear error on typing
                  }}
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
                    color={ANN.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 👇 NEW: Display Error Message on Screen 👇 */}
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={18} color={ANN.red} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* ── Login Button ── */}
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

          {/* ── Footer ── */}
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
  container: {
    flex: 1,
    backgroundColor: "#ffffff", // Light background
  },
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
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: ANN.blueLight,
    borderRadius: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 60,
  },
  logoWrapper: {
    width: 120, // साइज़ थोड़ा बड़ा किया ताकि लोगो साफ़ दिखे
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain", // इससे इमेज बिना कटे पूरी दिखेगी
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: ANN.darkBlue,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: ANN.textSecondary,
    fontWeight: "500",
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: ANN.darkBlue,
    marginLeft: 4,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "700",
    color: ANN.red,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: ANN.border,
    borderRadius: 12,
    height: 56,
  },
  inputIcon: {
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: ANN.textPrimary,
    fontWeight: "500",
    ...((Platform.OS === "web" ? { outlineStyle: "none" } : {}) as any),
  },
  eyeBtn: {
    paddingHorizontal: 16,
    height: "100%",
    justifyContent: "center",
  },

  // 👇 NEW: Error Message Styles 👇
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ANN.redLight,
    borderWidth: 1,
    borderColor: "rgba(241, 107, 63, 0.4)",
    padding: 12,
    borderRadius: 10,
    marginTop: -8,
  },
  errorText: {
    color: ANN.red,
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
    flex: 1,
  },

  loginBtn: {
    backgroundColor: ANN.darkBlue,
    height: 56,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: ANN.darkBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    color: ANN.textSecondary,
    fontWeight: "500",
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: ANN.darkBlue,
  },
});
