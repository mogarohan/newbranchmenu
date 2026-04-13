import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { THEME } from "../../constants/theme";
import { useSession } from "../../context/SessionContext";
import { initEcho } from "../../services/echo";
import { OrderService } from "../../services/order.service";
import { SessionService } from "../../services/session.service";
import { billTabNotifier } from "./_layout";

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

export default function OrdersTab() {
  const { sessionToken, tableData, menuData, orders, setOrders, clearSession } =
    useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "live" | "offline"
  >("connecting");

  const echoRef = useRef<any>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());

  const currency = menuData?.restaurant?.currency_symbol || "₹";
  const sessionId =
    menuData?.session?.id || menuData?.session?.session_id || tableData?.tId;

  const mergeOrders = (incomingOrders: any[]) => {
    setOrders((prev) => {
      const map = new Map(prev.map((o) => [o.id, o]));

      incomingOrders.forEach((incoming) => {
        const existing = map.get(incoming.id);

        if (existing) {
          map.set(incoming.id, {
            ...existing,
            ...incoming,
            // Strictly preserve the existing items if the incoming payload is a lightweight socket update
            items:
              incoming.items && incoming.items.length > 0
                ? incoming.items
                : existing.items,
          });
        } else {
          map.set(incoming.id, incoming);
        }
      });

      return Array.from(map.values())
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 50);
    });
  };

  const fetchOrders = useCallback(
    async (signal?: AbortSignal) => {
      if (!sessionToken) return;
      try {
        const data = await OrderService.getOrders(sessionToken, signal);
        const incomingOrders = Array.isArray(data) ? data : data.orders || [];
        mergeOrders(incomingOrders);
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error("Failed to fetch orders", e);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchOrders(abortController.signal);
    return () => abortController.abort();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();

    if (connectionStatus === "offline" && echoRef.current) {
      setConnectionStatus("connecting");
      echoRef.current.connector.pusher.connection.connect();
    }
  };

  useEffect(() => {
    if (!sessionToken || !sessionId) {
      setConnectionStatus("offline");
      return;
    }

    let isMounted = true;

    if (!echoRef.current) {
      echoRef.current = initEcho(sessionToken);
    }
    const echoInstance = echoRef.current;

    echoInstance.connector.pusher.connection.bind(
      "state_change",
      (states: any) => {
        if (!isMounted) return;
        if (states.current === "connected") setConnectionStatus("live");
        else if (states.current === "connecting")
          setConnectionStatus("connecting");
        else if (
          ["disconnected", "unavailable", "failed"].includes(states.current)
        ) {
          setConnectionStatus("offline");
        }
      },
    );

    echoInstance.connector.pusher.connection.bind("error", () => {
      if (!isMounted) return;
      setConnectionStatus("offline");
    });

    echoInstance
      .private(`session.${sessionId}`)
      .listen(".OrderStatusUpdated", (event: any) => {
        if (!isMounted) return;
        const eventId = event.event_id;
        if (eventId) {
          if (processedEventsRef.current.has(eventId)) return;
          processedEventsRef.current.add(eventId);
        }
        if (event.order) {
          mergeOrders([event.order]);
          // 👇 Trigger a silent background fetch to grab the full items array
          fetchOrders();
        }
      })
      .listen(".SessionEnded", async () => {
        if (!isMounted) return;
        Alert.alert(
          "Thank You!",
          "Your table session has been closed by the restaurant. We hope to see you again soon!",
        );
        await clearSession();
        router.replace("/");
      });

    return () => {
      isMounted = false;
      if (echoRef.current) {
        if (echoRef.current.connector?.pusher?.connection) {
          echoRef.current.connector.pusher.connection.unbind_all();
        }
        echoRef.current.leave(`session.${sessionId}`);
        echoRef.current.disconnect();
        echoRef.current = null;
      }
    };
  }, [sessionToken, sessionId, fetchOrders]);

  const displayOrders = Array.isArray(orders) ? orders : [];

  const handleCallWaiter = async () => {
    if (!sessionToken) return;
    try {
      await SessionService.callWaiter(sessionToken);
      if (Platform.OS === "web") {
        window.alert("A staff member has been alerted and is on the way.");
      } else {
        Alert.alert(
          "Waiter Notified",
          "A staff member has been alerted and is on the way.",
        );
      }
    } catch (e) {
      if (Platform.OS === "web")
        window.alert("Could not reach staff. Please try again.");
      else Alert.alert("Error", "Could not reach staff. Please try again.");
    }
  };

  // ─── NEW: LOGIC FOR VISUAL TRACKER ───
  const getStepIndex = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s === "cancelled" || s === "rejected") return -1;
    if (s === "served" || s === "completed") return 4;
    if (s === "ready") return 3;
    if (s === "preparing") return 2;
    // placed, pending, accepted
    return 1;
  };

  const STEPS = [
    { id: 1, label: "Placed", icon: "check" },
    { id: 2, label: "Preparing", icon: "restaurant" },
    { id: 3, label: "Ready", icon: "notifications" },
    { id: 4, label: "Served", icon: "room-service" },
  ];

  const renderOrderItem = ({
    item: order,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const isCancelled =
      order.status?.toLowerCase() === "cancelled" ||
      order.status?.toLowerCase() === "rejected";

    const displayTotal = isCancelled
      ? 0
      : parseFloat(String(order.total_amount)) || 0;

    const displayOrderNumber = displayOrders.length - index;
    const currentStep = getStepIndex(order.status);

    return (
      <View
        style={[
          styles.orderCard,
          isCancelled && { opacity: 0.6, borderColor: THEME.danger },
        ]}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text
              style={[
                styles.orderId,
                isCancelled && {
                  textDecorationLine: "line-through",
                  color: THEME.textSecondary,
                },
              ]}
            >
              Order #{displayOrderNumber}
            </Text>
            <Text style={styles.orderTime}>
              Placed by {order.customer_name || "Guest"}
            </Text>
          </View>
          {isCancelled && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>CANCELLED</Text>
            </View>
          )}
        </View>

        {/* ─── VISUAL STATUS TRACKER ─── */}
        {!isCancelled && (
          <View style={styles.trackerContainer}>
            {/* Background Line */}
            <View style={styles.trackerLineBg} />
            {/* Active Progress Line */}
            <View
              style={[
                styles.trackerLineActive,
                { width: `${((Math.max(1, currentStep) - 1) / 3) * 100}%` },
              ]}
            />

            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const isPending = currentStep < step.id;

              return (
                <View key={`step-${step.id}`} style={styles.stepWrapper}>
                  {/* Outer Glow for Current Step */}
                  <View
                    style={[
                      styles.stepIconContainer,
                      isCurrent && styles.stepIconContainerActiveGlow,
                      isCompleted && styles.stepIconContainerCompleted,
                      isPending && styles.stepIconContainerPending,
                    ]}
                  >
                    <MaterialIcons
                      name={step.icon as any}
                      size={18}
                      color={
                        isCurrent || isCompleted
                          ? "#FFFFFF"
                          : THEME.textSecondary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isCurrent && styles.stepLabelCurrent,
                      isCompleted && styles.stepLabelCompleted,
                      isPending && styles.stepLabelPending,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── ITEMS LIST ─── */}
        <View style={styles.itemsList}>
          {Array.isArray(order.items) &&
            order.items.map((item: any, i: number) => {
              const unitPrice =
                parseFloat(String(item.unit_price || item.price || 0)) || 0;
              const qty = parseInt(String(item.quantity || 1), 10) || 1;
              const totalPrice =
                parseFloat(String(item.total_price || unitPrice * qty)) || 0;

              return (
                <View key={`item-${item.id || i}`} style={styles.orderItem}>
                  <View
                    style={{ flexDirection: "row", flex: 1, paddingRight: 12 }}
                  >
                    <Text
                      style={[
                        styles.itemQtyBadge,
                        isCancelled && { color: THEME.textSecondary },
                      ]}
                    >
                      {qty}x
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.itemText,
                          isCancelled && {
                            textDecorationLine: "line-through",
                            color: THEME.textSecondary,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.menu_item?.name || item.item_name || "Menu Item"}
                      </Text>
                      {item.notes && (
                        <Text style={styles.itemNote}>Note: {item.notes}</Text>
                      )}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.itemPrice,
                      isCancelled && {
                        textDecorationLine: "line-through",
                        color: THEME.textSecondary,
                      },
                    ]}
                  >
                    {currency}
                    {totalPrice.toFixed(2)}
                  </Text>
                </View>
              );
            })}
        </View>

        {order.notes && !isCancelled && (
          <View style={styles.orderLevelNote}>
            <Ionicons
              name="chatbox-ellipses-outline"
              size={14}
              color={ANN.darkBlue}
            />
            <Text style={styles.orderLevelNoteText}>{order.notes}</Text>
          </View>
        )}

        <View style={styles.orderFooter}>
          <Text style={styles.totalText}>Order Total</Text>
          <Text
            style={[
              styles.totalPriceLarge,
              isCancelled && { color: THEME.danger },
            ]}
          >
            {currency}
            {displayTotal.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    // ─── MAIN WRAPPER FOR GLASS BACKGROUND EFFECT ───
    <View style={styles.mainWrapper}>
      <Image
        source={require("../../assets/images/bg.png")}
        style={styles.bgImage}
      />
      <View style={styles.bgOverlay} />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Order History</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={[
                styles.statusIndicator,
                connectionStatus === "live"
                  ? styles.bgSuccess
                  : connectionStatus === "connecting"
                    ? styles.bgWarning
                    : styles.bgDanger,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  connectionStatus === "live"
                    ? styles.dotSuccess
                    : connectionStatus === "connecting"
                      ? styles.dotWarning
                      : styles.dotDanger,
                ]}
              />
              <Text style={styles.statusIndicatorText}>
                {connectionStatus === "live"
                  ? "Live"
                  : connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Offline"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              disabled={refreshing || loading}
            >
              <Ionicons name="reload" size={18} color={ANN.darkBlue} />
            </TouchableOpacity>
          </View>
        </View>

        {loading && displayOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={ANN.red} />
            <Text style={styles.emptyStateText}>Loading orders...</Text>
          </View>
        ) : displayOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="receipt-outline"
              size={64}
              color={THEME.textSecondary}
              style={{ opacity: 0.3 }}
            />
            <Text style={styles.emptyStateTitle}>No orders found.</Text>
            <Text style={styles.emptyStateText}>
              When you place orders, they will appear here.
            </Text>
            <TouchableOpacity
              style={styles.webSafeRefreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={ANN.red} />
              ) : (
                <>
                  <Ionicons
                    name="reload"
                    size={16}
                    color={ANN.red}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.webSafeRefreshText}>Tap to Refresh</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={displayOrders}
            keyExtractor={(item) => `order-${item.id}`}
            renderItem={renderOrderItem}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== "ios"}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ANN.red}
              />
            }
            ListFooterComponent={() => (
              <View style={styles.askBillContainer}>
                <TouchableOpacity
                  style={styles.askBillBtn}
                  onPress={async () => {
                    if (sessionToken) {
                      try {
                        // Silently notify the manager in the background
                        await SessionService.requestBill(sessionToken);
                      } catch (e) {}
                    }
                    billTabNotifier.show();
                    setTimeout(() => {
                      router.push({
                        pathname: "/(tabs)/bills",
                        params: { billRequested: "true" },
                      });
                    }, 100);
                  }}
                >
                  <MaterialIcons name="receipt-long" size={24} color="#fff" />
                  <Text style={styles.askBillBtnText}>Ask for Bill</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
        <TouchableOpacity style={styles.fab} onPress={handleCallWaiter}>
          <Ionicons name="notifications-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── BACKGROUND STYLES ──
  mainWrapper: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    opacity: 0.15, // Doodle watermark effect
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.85)", // Glass effect opacity
  },
  container: {
    flex: 1,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: ANN.darkBlue },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bgSuccess: { backgroundColor: "rgba(16, 185, 129, 0.1)" },
  bgWarning: { backgroundColor: "rgba(245, 158, 11, 0.1)" },
  bgDanger: { backgroundColor: "rgba(239, 68, 68, 0.1)" },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  dotSuccess: { backgroundColor: THEME.success },
  dotWarning: { backgroundColor: THEME.warning },
  dotDanger: { backgroundColor: THEME.danger },
  statusIndicatorText: {
    fontSize: 11,
    fontWeight: "bold",
    color: THEME.textSecondary,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.2)",
    ...(Platform.OS === "web" ? { cursor: "pointer" } : ({} as any)),
  },
  scrollContent: { padding: 16, paddingBottom: 100 },

  // ── ORDER CARD (GLASS EFFECT) ──
  orderCard: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.05)" } as any,
      default: {
        shadowColor: ANN.darkBlue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  orderId: { fontSize: 18, fontWeight: "900", color: ANN.darkBlue },
  orderTime: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },

  cancelledBadge: {
    backgroundColor: THEME.danger + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cancelledText: { fontSize: 12, fontWeight: "bold", color: THEME.danger },

  // ── VISUAL TRACKER STYLES ──
  trackerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    position: "relative",
    paddingHorizontal: 10,
    marginBottom: 24,
    marginTop: 8,
  },
  trackerLineBg: {
    position: "absolute",
    top: 18, // Center of the icons
    left: 30,
    right: 30,
    height: 3,
    backgroundColor: "#E2E8F0",
    zIndex: 1,
  },
  trackerLineActive: {
    position: "absolute",
    top: 18,
    left: 30,
    height: 3,
    backgroundColor: ANN.red, // Orange brand color
    zIndex: 2,
  },
  stepWrapper: {
    alignItems: "center",
    zIndex: 3,
    width: 60,
  },
  stepIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  stepIconContainerCompleted: {
    backgroundColor: ANN.red, // Completed steps are solid orange
  },
  stepIconContainerActiveGlow: {
    backgroundColor: ANN.red,
    borderWidth: 4,
    borderColor: ANN.orangeLight, // Outer glow effect
    width: 44,
    height: 44,
    borderRadius: 22,
    transform: [{ translateY: -4 }], // Adjust for size increase to keep center aligned
  },
  stepIconContainerPending: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stepLabel: {
    fontSize: 10,
    marginTop: 8,
    textAlign: "center",
  },
  stepLabelCompleted: { color: ANN.red, fontWeight: "bold" },
  stepLabelCurrent: {
    color: ANN.red,
    fontWeight: "900",
    borderBottomWidth: 2,
    borderBottomColor: ANN.red,
  },
  stepLabelPending: { color: THEME.textSecondary, fontWeight: "600" },

  // ── ITEMS LIST ──
  itemsList: { gap: 12, marginTop: 8 },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemQtyBadge: {
    color: ANN.darkBlue,
    fontWeight: "900",
    fontSize: 14,
    marginRight: 8,
    width: 24,
  },
  itemText: { fontSize: 15, fontWeight: "bold", color: THEME.textPrimary },
  itemPrice: { fontSize: 15, color: ANN.darkBlue, fontWeight: "900" },
  itemNote: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  orderLevelNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ANN.blueLight,
    padding: 12,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.2)",
  },
  orderLevelNoteText: {
    fontSize: 13,
    color: ANN.darkBlue,
    marginLeft: 8,
    flex: 1,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  totalText: { fontSize: 16, fontWeight: "bold", color: THEME.textSecondary },
  totalPriceLarge: { fontSize: 20, fontWeight: "900", color: ANN.red },

  // ── EMPTY STATE ──
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: ANN.darkBlue,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  webSafeRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ANN.orangeLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: ANN.orange,
    ...(Platform.OS === "web" ? { cursor: "pointer" } : ({} as any)),
  },
  webSafeRefreshText: {
    color: ANN.red,
    fontWeight: "bold",
    fontSize: 14,
  },

  // ── FLOATING ACTION BUTTON (CALL WAITER) ──
  fab: {
    position: "absolute",
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ANN.darkBlue,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      default: {
        shadowColor: ANN.darkBlue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },

  // ── ASK BILL BUTTON ──
  askBillContainer: { marginTop: 10, marginBottom: 40 },
  askBillBtn: {
    backgroundColor: ANN.red,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: ANN.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  askBillBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
