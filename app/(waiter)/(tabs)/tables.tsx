import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
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

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Table {
  id: number;
  number: string | number;
  status: "available" | "occupied" | "cleaning";
  capacity: number;
  updatedAt?: number;
}

export default function WaiterTablesScreen() {
  const { waiter, token, lastTableUpdate } = useWaiter();

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchTables = useCallback(async () => {
    if (!token) return;
    try {
      const data = await WaiterService.tables.list(token);
      const sortedTables = Array.isArray(data)
        ? data.sort((a, b) => Number(a.number) - Number(b.number))
        : [];

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTables(sortedTables);
    } catch (error: any) {
      logEvent("ERROR", "FETCH_TABLES_FAILED", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTables();
    }, 120000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  // 3. ZERO-API REALTIME SYNC (With chronological & branch protection)
  useEffect(() => {
    if (lastTableUpdate) {
      // Branch Isolation Check
      if (
        waiter?.branch_id &&
        lastTableUpdate.branchId &&
        lastTableUpdate.branchId !== waiter.branch_id
      ) {
        return;
      }

      setTables((prev) => {
        const exists = prev.find((t) => t.id === lastTableUpdate.tableId);

        if (!exists || exists.status === lastTableUpdate.status) return prev;

        if (exists.updatedAt && exists.updatedAt > lastTableUpdate.updatedAt)
          return prev;

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        return prev.map((t) =>
          t.id === lastTableUpdate.tableId
            ? {
                ...t,
                status: lastTableUpdate.status,
                updatedAt: lastTableUpdate.updatedAt,
              }
            : t,
        );
      });
    }
  }, [lastTableUpdate, waiter?.branch_id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTables();
  };

  const handleUpdateStatus = async (
    newStatus: "available" | "occupied" | "cleaning",
  ) => {
    if (!token || !selectedTable) return;
    setUpdating(true);

    const localTimestamp = Math.floor(Date.now() / 1000);

    try {
      await WaiterService.tables.updateStatus(
        selectedTable.id,
        newStatus,
        token,
      );

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable.id
            ? { ...t, status: newStatus, updatedAt: localTimestamp }
            : t,
        ),
      );

      setSelectedTable(null);
    } catch (error: any) {
      logEvent("ERROR", "UPDATE_TABLE_STATUS_FAILED", error.message);
      Alert.alert("Error", "Could not update table status.");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "available":
        return {
          color: "#10b981", // Success Green
          icon: "check-circle",
          label: "Available",
          bgColor: "#d1fae5",
        };
      case "occupied":
        return {
          color: ANN.red, // Brand Red for Occupied
          icon: "people",
          label: "Occupied",
          bgColor: ANN.redLight,
        };
      case "cleaning":
        return {
          color: ANN.orange, // Brand Orange for Cleaning
          icon: "cleaning-services",
          label: "Cleaning",
          bgColor: ANN.orangeLight,
        };
      default:
        return {
          color: "#64748b",
          icon: "help-outline",
          label: "Unknown",
          bgColor: "#f1f5f9",
        };
    }
  };

  const renderTableCard = ({ item }: { item: Table }) => {
    const config = getStatusConfig(item.status);

    return (
      <TouchableOpacity
        style={[styles.tableCard, { borderTopColor: config.color }]}
        onPress={() => setSelectedTable(item)}
      >
        <View style={styles.cardTop}>
          <Text style={styles.tableNumber}>T{item.number}</Text>
          <View
            style={[styles.iconWrapper, { backgroundColor: config.bgColor }]}
          >
            <MaterialIcons
              name={config.icon as any}
              size={20}
              color={config.color}
            />
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={[styles.statusText, { color: config.color }]}>
            {config.label}
          </Text>
          <View style={styles.capacityBadge}>
            <MaterialIcons name="person" size={12} color={ANN.darkBlue} />
            <Text style={styles.capacityText}>{item.capacity}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isAvailable = selectedTable?.status === "available";

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
            <Text style={styles.headerTitle}>Floor Plan</Text>
            <Text style={styles.headerSubtitle}>
              Tap a table to update status
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
            <Text
              style={{ marginTop: 16, color: ANN.darkBlue, fontWeight: "bold" }}
            >
              Loading floor plan...
            </Text>
          </View>
        ) : (
          <FlatList
            data={tables}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTableCard}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ANN.red}
              />
            }
          />
        )}

        {/* ── STATUS UPDATE MODAL (GLASS UI) ── */}
        <Modal visible={!!selectedTable} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Table {selectedTable?.number}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedTable(null)}
                  disabled={updating}
                  style={styles.closeModalBtn}
                >
                  <MaterialIcons name="close" size={24} color={ANN.darkBlue} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Set current status:</Text>

              <View style={styles.modalOptions}>
                {/* Available */}
                <TouchableOpacity
                  style={[
                    styles.statusOption,
                    {
                      borderColor: "#10b981",
                      backgroundColor: "#d1fae5",
                    },
                  ]}
                  onPress={() => handleUpdateStatus("available")}
                  disabled={updating || selectedTable?.status === "available"}
                >
                  <MaterialIcons
                    name="check-circle"
                    size={24}
                    color="#10b981"
                  />
                  <Text style={[styles.statusOptionText, { color: "#10b981" }]}>
                    Available
                  </Text>
                </TouchableOpacity>

                {/* Occupied */}
                <TouchableOpacity
                  style={[
                    styles.statusOption,
                    {
                      borderColor: ANN.red,
                      backgroundColor: ANN.redLight,
                    },
                  ]}
                  onPress={() => handleUpdateStatus("occupied")}
                  disabled={updating || selectedTable?.status === "occupied"}
                >
                  <MaterialIcons name="people" size={24} color={ANN.red} />
                  <Text style={[styles.statusOptionText, { color: ANN.red }]}>
                    Occupied
                  </Text>
                </TouchableOpacity>

                {/* Cleaning */}
                <TouchableOpacity
                  style={[
                    styles.statusOption,
                    {
                      borderColor: ANN.orange,
                      backgroundColor: ANN.orangeLight,
                    },
                    isAvailable && { opacity: 0.4 },
                  ]}
                  onPress={() => handleUpdateStatus("cleaning")}
                  disabled={
                    updating ||
                    selectedTable?.status === "cleaning" ||
                    isAvailable
                  }
                >
                  <MaterialIcons
                    name="cleaning-services"
                    size={24}
                    color={ANN.orange}
                  />
                  <Text
                    style={[styles.statusOptionText, { color: ANN.orange }]}
                  >
                    Cleaning
                  </Text>
                </TouchableOpacity>
              </View>

              {updating && (
                <ActivityIndicator
                  size="small"
                  color={ANN.darkBlue}
                  style={{ marginTop: 20 }}
                />
              )}
            </View>
          </View>
        </Modal>
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

  centerState: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 12, paddingBottom: 100 },
  row: { justifyContent: "space-between", paddingHorizontal: 4 },

  // ── TABLE CARD (GLASS UI) ──
  tableCard: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: "48%",
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
    borderTopWidth: 4,
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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  tableNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: ANN.darkBlue,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  statusText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  capacityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ANN.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: "800",
    color: ANN.darkBlue,
    marginLeft: 4,
  },

  // ── MODAL UI (GLASS) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "rgba(255, 255, 255, 0.95)", // Glass effect
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.1)",
    ...Platform.select({
      web: { boxShadow: "0px -8px 24px rgba(0,0,0,0.15)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: ANN.darkBlue,
  },
  closeModalBtn: {
    padding: 4,
    backgroundColor: ANN.blueLight,
    borderRadius: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    fontWeight: "600",
  },
  modalOptions: { gap: 12 },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    gap: 12,
  },
  statusOptionText: { fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});
