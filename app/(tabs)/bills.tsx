import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share, // 👈 Safe Native Share for Mobile
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { THEME } from "../../constants/theme";
import { useSession } from "../../context/SessionContext";
import { initEcho } from "../../services/echo";
import { OrderService } from "../../services/order.service";

export default function BillsTab() {
  const { sessionToken, tableData, menuData, orders, setOrders } = useSession();
  const { billRequested } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "live" | "offline"
  >("connecting");

  const echoRef = useRef<any>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());

  const currency = menuData?.restaurant?.currency_symbol || "₹";
  const sessionId = menuData?.session?.id || menuData?.session?.session_id;

  const mergeOrders = (incomingOrders: any[]) => {
    setOrders((prev) => {
      const map = new Map(prev.map((o) => [o.id, o]));
      incomingOrders.forEach((o) => map.set(o.id, o));
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
  };

  const fetchOrders = useCallback(async (signal?: AbortSignal) => {
    if (!sessionToken) return;
    try {
      const data = await OrderService.getOrders(sessionToken, signal);
      mergeOrders(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Failed to fetch orders", e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

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

    echoInstance.connector.pusher.connection.bind("state_change", (states: any) => {
      if (!isMounted) return;
      if (states.current === "connected") setConnectionStatus("live");
      else if (states.current === "connecting") setConnectionStatus("connecting");
      else if (["disconnected", "unavailable", "failed"].includes(states.current)) {
        setConnectionStatus("offline");
      }
    });

    echoInstance.connector.pusher.connection.bind("error", () => {
      if (!isMounted) return;
      setConnectionStatus("offline");
    });

    echoInstance.private(`session.${sessionId}`).listen(".OrderStatusUpdated", (event: any) => {
      if (!isMounted) return;
      const eventId = event.event_id;
      if (eventId) {
        if (processedEventsRef.current.has(eventId)) return;
        processedEventsRef.current.add(eventId);
      }
      if (event.order) {
        mergeOrders([event.order]);
      }
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
  }, [sessionToken, sessionId]);

  const validOrders = useMemo(() => {
    return Array.isArray(orders)
      ? orders.filter(o => {
          const s = o.status?.toLowerCase() || "";
          return s !== "cancelled" && s !== "rejected";
        })
      : [];
  }, [orders]);

  const { consolidatedItems, totalBill } = useMemo(() => {
    const itemMap = new Map();
    let total = 0;

    validOrders.forEach(order => {
      total += parseFloat(String(order.total_amount)) || 0;

      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          const key = item.menu_item_id || item.item_name; 
          const itemName = item.menu_item?.name || item.item_name || "Menu Item";
          
          const itemPrice = parseFloat(String(item.unit_price || item.price || 0)) || 0;
          const itemQty = parseInt(String(item.quantity || 1), 10) || 1;
          
          if (itemMap.has(key)) {
            const existing = itemMap.get(key);
            existing.quantity += itemQty;
            existing.total_price += (itemPrice * itemQty);
          } else {
            itemMap.set(key, {
              id: key,
              name: itemName,
              unit_price: itemPrice,
              quantity: itemQty,
              total_price: itemPrice * itemQty,
            });
          }
        });
      }
    });

    return {
      consolidatedItems: Array.from(itemMap.values()),
      totalBill: total || 0,
    };
  }, [validOrders]);

  // 🔥 HTML DOWNLOAD LOGIC 🔥
  const handleDownloadBill = async () => {
    // 🔥 100% DYNAMIC: Backend se jo restaurant ka naam aayega, wahi use hoga
    const restaurantName = menuData?.restaurant?.name || "Restaurant Bill";
    const tableNum = tableData?.tId || "-";
    const dateStr = new Date().toLocaleString();

    if (Platform.OS === "web") {
      // 🌐 WEB: Direct HTML Download (No PDF packages needed)
      let itemsHtml = '';
      consolidatedItems.forEach(item => {
        itemsHtml += `
          <tr>
            <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc; font-size: 14px;">${item.quantity}x</td>
            <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc;">
              <strong style="font-size: 14px;">${item.name}</strong><br>
              <small style="color: #666; font-size: 12px;">(${currency}${(item.unit_price || 0).toFixed(2)})</small>
            </td>
            <td style="padding: 8px 4px; border-bottom: 1px dashed #ccc; text-align: right; font-size: 14px; font-weight: bold;">${currency}${(item.total_price || 0).toFixed(2)}</td>
          </tr>
        `;
      });

      const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <title>Bill - Table ${tableNum}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #000; background: #fff; max-width: 400px; margin: auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h2 { margin: 5px 0; font-size: 28px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #111; }
            .header p { margin: 2px 0; font-size: 15px; color: #444; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; border-bottom: 2px solid #000; padding: 8px 4px; font-size: 15px; text-transform: uppercase; }
            th.right { text-align: right; }
            .total-row { display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; border-top: 2px solid #000; padding-top: 15px; margin-top: 15px; }
            .footer { text-align: center; margin-top: 40px; font-size: 14px; font-weight: bold; color: #222; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${restaurantName}</h2>
            <p>Table ${tableNum}</p>
            <p style="font-size: 12px; color: #666;">${dateStr}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Qty</th>
                <th style="width: 60%;">Item</th>
                <th style="width: 25%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total-row">
            <span>GRAND TOTAL</span>
            <span>${currency}${(totalBill || 0).toFixed(2)}</span>
          </div>
          <div class="footer">
            Thank You for Visiting!
          </div>
        </body>
        </html>
      `;

      try {
        const blob = new Blob([receiptHTML], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Bill_Table_${tableNum}.html`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download Error: ", err);
      }
    } else {
      // 📱 MOBILE: Native Text Share via WhatsApp/Messages
      try {
        let receiptText = `🧾 *${restaurantName.toUpperCase()}* 🧾\n`;
        receiptText += `Table: ${tableNum}\n`;
        receiptText += `Date: ${dateStr}\n`;
        receiptText += `--------------------------------\n`;
        
        consolidatedItems.forEach(item => {
          receiptText += `${item.quantity}x ${item.name}\n`;
          receiptText += `   ${currency}${(item.total_price || 0).toFixed(2)} (${currency}${(item.unit_price || 0).toFixed(2)}/ea)\n`;
        });
        
        receiptText += `--------------------------------\n`;
        receiptText += `*GRAND TOTAL: ${currency}${(totalBill || 0).toFixed(2)}*\n`;
        receiptText += `--------------------------------\n`;
        receiptText += `Thank You for Visiting!\n`;

        await Share.share({
          message: receiptText,
          title: `Bill_Table_${tableNum}`,
        });
      } catch (error: any) {
        Alert.alert("Error", "Could not share bill.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Final Bill</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={refreshing || loading}>
          <Ionicons name="reload" size={18} color={THEME.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
      >
        {loading && consolidatedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={THEME.primary} />
            <Text style={styles.emptyStateText}>Loading bill...</Text>
          </View>
        ) : consolidatedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={THEME.textSecondary} style={{ opacity: 0.3 }} />
            <Text style={styles.emptyStateTitle}>No items billed yet.</Text>
            <Text style={styles.emptyStateText}>Your ordered items will appear here.</Text>
          </View>
        ) : ( 
          <View style={styles.centerCard}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="check-circle" size={50} color={THEME.success} />
            </View>
            <Text style={styles.readyText}>Your Bill is Ready!</Text>
            <Text style={styles.subText}>Table {tableData?.tId || "-"}</Text>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>{currency}{(totalBill || 0).toFixed(2)}</Text>
            </View>

            <TouchableOpacity 
              style={styles.downloadBigBtn} 
              onPress={handleDownloadBill} 
            >
              <Ionicons name="cloud-download-outline" size={24} color="#fff" />
              <Text style={styles.downloadBigBtnText}>
                {Platform.OS === 'web' ? "Download Bill" : "Share Bill"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    borderBottomColor: THEME.border,
    alignItems: "center",
    backgroundColor: THEME.cardBg,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: THEME.textPrimary },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
    ...(Platform.OS === "web" ? { cursor: "pointer" } : ({} as any)),
  },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 20 
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: "center",
  },
  
  centerCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      default: {
        shadowColor: THEME.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
      },
    }),
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  readyText: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  subText: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginBottom: 30,
  },
  totalBox: {
    width: '100%',
    backgroundColor: THEME.background,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: THEME.border,
    borderStyle: 'dashed',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 40,
    fontWeight: '900',
    color: THEME.primary,
  },
  downloadBigBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  downloadBigBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});