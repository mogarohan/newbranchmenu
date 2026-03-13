import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WAITER_THEME } from "../../../constants/theme";
import { useWaiter } from "../../../context/WaiterContext";
import { WaiterService } from "../../../services/waiter.service";
import { logEvent } from "../../../utils/logger";

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

    // 🔥 NEW: Check if the order is actually ready to be served
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
                isUrgent &&
                  isReadyToServe && { backgroundColor: WAITER_THEME.danger },
                !isReadyToServe && {
                  backgroundColor: WAITER_THEME.textSecondary,
                },
              ]}
            >
              <Text style={styles.tableBadgeText}>Table {displayTable}</Text>
            </View>
            <View>
              <Text style={styles.orderIdText}>
                Order #{item.id}{" "}
                <Text style={{ color: WAITER_THEME.primary }}>
                  • {displayCustomer}
                </Text>
              </Text>
              <Text
                style={[
                  styles.timeText,
                  isUrgent &&
                    isReadyToServe && {
                      color: WAITER_THEME.danger,
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
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(245, 158, 11, 0.1)", // Yellow for kitchen
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: isReadyToServe
                    ? WAITER_THEME.status.available
                    : WAITER_THEME.warning,
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
                    !isReadyToServe && { color: WAITER_THEME.textSecondary },
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
              color={WAITER_THEME.warning}
            />
            <Text style={styles.orderNoteText}>{item.notes}</Text>
          </View>
        )}

        {/* 🔥 NEW: Contextual Action Area */}
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
            <ActivityIndicator color={WAITER_THEME.warning} size="small" />
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Active Orders</Text>
          <Text style={styles.headerSubtitle}>
            {orders.filter((o) => o.status === "ready").length} ready to serve
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons name="reload" size={20} color={WAITER_THEME.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={WAITER_THEME.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerState}>
          <MaterialIcons
            name="done-all"
            size={80}
            color="rgba(16, 185, 129, 0.2)"
            style={{ marginBottom: 16 }}
          />
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
              tintColor={WAITER_THEME.primary}
            />
          }
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={Platform.OS !== "ios"}
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
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WAITER_THEME.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: WAITER_THEME.ui.border,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
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

  card: {
    backgroundColor: WAITER_THEME.cardBgLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  cardMuted: { opacity: 0.85, backgroundColor: "#fafafa" }, // 🔥 Dims non-ready orders
  cardUrgent: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderLeftWidth: 4,
    borderLeftColor: WAITER_THEME.danger,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: WAITER_THEME.ui.border,
  },
  tableBadge: {
    backgroundColor: WAITER_THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tableBadgeText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  orderIdText: {
    fontSize: 13,
    fontWeight: "600",
    color: WAITER_THEME.textSecondary,
  },
  timeText: { fontSize: 13, color: WAITER_THEME.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },

  itemsContainer: { gap: 12, marginBottom: 16 },
  itemRow: { flexDirection: "row", alignItems: "flex-start" },
  itemQty: {
    fontSize: 15,
    fontWeight: "900",
    color: WAITER_THEME.primary,
    width: 28,
    marginRight: 8,
    marginTop: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: WAITER_THEME.textPrimary,
  },
  itemNote: {
    fontSize: 13,
    color: WAITER_THEME.danger,
    fontStyle: "italic",
    marginTop: 4,
  },

  orderNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  orderNoteText: { fontSize: 14, color: "#B45309", flex: 1, fontWeight: "500" },

  serveBtn: {
    backgroundColor: WAITER_THEME.status.available,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    height: 54,
    borderRadius: 12,
  },
  serveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  // 🔥 NEW: Kitchen Status Banner Styles
  kitchenStatusBox: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    height: 54,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  kitchenStatusText: {
    color: "#B45309",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
