import { Ionicons, MaterialIcons } from "@expo/vector-icons";
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
import { useWaiter } from "../../../context/WaiterContext";
import { WaiterService } from "../../../services/waiter.service";
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

export default function WaiterOrdersScreen() {
  const { token, ordersReadyCount } = useWaiter();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [servingId, setServingId] = useState<number | null>(null);

  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🔥 Fetch Orders Logic (Smart Rush-Hour Sorting)
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const data = await WaiterService.orders.ready(token);
      const activeOrders = Array.isArray(data)
        ? data
            .filter((o) =>
              ["pending", "placed", "preparing", "ready"].includes(o.status),
            )
            .sort((a, b) => {
              // 1. READY orders ALWAYS float to the absolute top
              if (a.status === "ready" && b.status !== "ready") return -1;
              if (b.status === "ready" && a.status !== "ready") return 1;

              // 2. Otherwise, sort by oldest (longest waiting) first
              return (
                new Date(a.updated_at).getTime() -
                new Date(b.updated_at).getTime()
              );
            })
        : [];
      setOrders(activeOrders);
    } catch (error: any) {
      logEvent("ERROR", "FETCH_READY_ORDERS_FAILED", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (ordersReadyCount > 0) {
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
      refreshTimeout.current = setTimeout(() => {
        fetchOrders();
      }, 500);
    }
  }, [ordersReadyCount, fetchOrders]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prev) => [...prev]);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleMarkServed = async (orderId: number) => {
    if (!token) return;
    setServingId(orderId);

    try {
      await WaiterService.orders.serve(orderId, token);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (error: any) {
      logEvent("ERROR", "MARK_SERVED_FAILED", error.message);
      Alert.alert("Error", "Could not mark order as served. Please try again.");
    } finally {
      setServingId(null);
    }
  };

  const getWaitTime = (updatedAt: string) => {
    const diffMins = Math.floor(
      (new Date().getTime() - new Date(updatedAt).getTime()) / 60000,
    );
    if (diffMins < 1) return "Just now";
    return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const isUrgent =
      new Date().getTime() - new Date(item.updated_at).getTime() > 10 * 60000;
    const isServing = servingId === item.id;

    const displayTable =
      item.table_number ||
      item.table?.table_number ||
      item.session?.restaurant_table_id ||
      "?";
    const displayCustomer =
      item.customer_name || item.session?.customer_name || "Guest";
    const displayStatus = item.status ? item.status.toUpperCase() : "FRESH";

    // 🔥 Check if the order is actually ready to be served
    const isReadyToServe = item.status === "ready";

    return (
      <View
        style={[
          styles.card,
          isUrgent && styles.cardUrgent,
          !isReadyToServe && styles.cardMuted, // Dim the card if it's still in the kitchen
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={[
                styles.tableBadge,
                isUrgent && isReadyToServe && { backgroundColor: ANN.red },
                !isReadyToServe && { backgroundColor: ANN.blue },
              ]}
            >
              <Text style={styles.tableBadgeText}>Table {displayTable}</Text>
            </View>
            <View>
              <Text style={styles.orderIdText}>
                Order #{item.id}{" "}
                <Text style={{ color: ANN.darkBlue }}>• {displayCustomer}</Text>
              </Text>
              <Text
                style={[
                  styles.timeText,
                  isUrgent &&
                    isReadyToServe && {
                      color: ANN.red,
                      fontWeight: "bold",
                    },
                ]}
              >
                {getWaitTime(item.updated_at)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isReadyToServe
                  ? "rgba(16, 185, 129, 0.15)" // Greenish for Ready
                  : ANN.orangeLight, // Orange for Kitchen
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: isReadyToServe ? "#059669" : ANN.red,
                },
              ]}
            >
              {displayStatus}
            </Text>
          </View>
        </View>

        <View style={styles.itemsContainer}>
          {Array.isArray(item.items) &&
            item.items.map((orderItem: any, index: number) => (
              <View key={orderItem.id || index} style={styles.itemRow}>
                <Text
                  style={[
                    styles.itemQty,
                    !isReadyToServe && { color: "#64748b" },
                  ]}
                >
                  {orderItem.quantity}x
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {orderItem.menu_item?.name || orderItem.item_name}
                  </Text>
                  {orderItem.notes && (
                    <Text style={styles.itemNote}>Note: {orderItem.notes}</Text>
                  )}
                </View>
              </View>
            ))}
        </View>

        {item.notes && (
          <View style={styles.orderNoteBox}>
            <MaterialIcons
              name="speaker-notes"
              size={16}
              color={ANN.darkBlue}
            />
            <Text style={styles.orderNoteText}>{item.notes}</Text>
          </View>
        )}

        {/* 🔥 Contextual Action Area */}
        {isReadyToServe ? (
          <TouchableOpacity
            style={[styles.serveBtn, isServing && { opacity: 0.7 }]}
            onPress={() => handleMarkServed(item.id)}
            disabled={isServing || !token}
          >
            {isServing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="room-service" size={22} color="#fff" />
                <Text style={styles.serveBtnText}>Serve Now</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.kitchenStatusBox}>
            <ActivityIndicator color={ANN.red} size="small" />
            <Text style={styles.kitchenStatusText}>
              {displayStatus === "PREPARING"
                ? "Chef is cooking..."
                : "Waiting for Kitchen..."}
            </Text>
          </View>
        )}
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
            <Text style={styles.headerTitle}>Active Orders</Text>
            <Text style={styles.headerSubtitle}>
              <Text style={{ fontWeight: "bold", color: ANN.red }}>
                {orders.filter((o) => o.status === "ready").length}
              </Text>{" "}
              ready to serve
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons name="reload" size={20} color={ANN.darkBlue} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={ANN.orange} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centerState}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="done-all" size={50} color={ANN.darkBlue} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySub}>No active orders right now.</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderOrderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ANN.red}
              />
            }
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={10}
            removeClippedSubviews={Platform.OS !== "ios"}
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
    backgroundColor: "rgba(248, 250, 252, 0.85)", // Glass overlay
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
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ANN.blueLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
  },

  // ── EMPTY STATE ──
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
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

  // ── ORDER CARD (GLASS UI) ──
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.04)" } as any,
      default: {
        shadowColor: ANN.darkBlue,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardMuted: { opacity: 0.85, backgroundColor: "rgba(248, 250, 252, 0.7)" },
  cardUrgent: {
    borderColor: "rgba(241, 107, 63, 0.4)", // Orange/Red subtle border
    borderLeftWidth: 5,
    borderLeftColor: ANN.red,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42, 71, 149, 0.1)",
  },
  tableBadge: {
    backgroundColor: ANN.darkBlue,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: ANN.darkBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tableBadgeText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  orderIdText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
  },
  timeText: { fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: "600" },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },

  // ── ITEMS LIST ──
  itemsContainer: { gap: 12, marginBottom: 16 },
  itemRow: { flexDirection: "row", alignItems: "flex-start" },
  itemQty: {
    fontSize: 15,
    fontWeight: "900",
    color: ANN.red, // Orange/Red Qty
    width: 28,
    marginRight: 8,
    marginTop: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    color: ANN.darkBlue, // Dark Blue Item Name
  },
  itemNote: {
    fontSize: 13,
    color: ANN.orange,
    fontStyle: "italic",
    marginTop: 4,
    fontWeight: "500",
  },

  orderNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ANN.blueLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.1)",
  },
  orderNoteText: {
    fontSize: 14,
    color: ANN.darkBlue,
    flex: 1,
    fontWeight: "600",
  },

  // ── ACTION BUTTONS ──
  serveBtn: {
    backgroundColor: ANN.red, // Primary Action (Orange/Red)
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    height: 54,
    borderRadius: 14,
    shadowColor: ANN.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  serveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  kitchenStatusBox: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    height: 54,
    borderRadius: 14,
    backgroundColor: ANN.orangeLight,
    borderWidth: 1,
    borderColor: ANN.orange,
  },
  kitchenStatusText: {
    color: ANN.red,
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
