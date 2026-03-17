import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { WAITER_THEME } from "../../../constants/theme";
import { useWaiter } from "../../../context/WaiterContext";
import { WaiterService } from "../../../services/waiter.service";
import { logEvent } from "../../../utils/logger";

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
  // 🔥 Fetching waiter object along with lastTableUpdate
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
      // 👇 NEW: Branch Isolation Check
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
  }, [lastTableUpdate, waiter?.branch_id]); // Dependency updated

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
          color: WAITER_THEME.status.available,
          icon: "check-circle",
          label: "Available",
        };
      case "occupied":
        return {
          color: WAITER_THEME.status.occupied,
          icon: "people",
          label: "Occupied",
        };
      case "cleaning":
        return {
          color: WAITER_THEME.status.cleaning,
          icon: "cleaning-services",
          label: "Cleaning",
        };
      default:
        return {
          color: WAITER_THEME.textSecondary,
          icon: "help-outline",
          label: "Unknown",
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
          <MaterialIcons
            name={config.icon as any}
            size={20}
            color={config.color}
          />
        </View>

        <View style={styles.cardBottom}>
          <Text style={[styles.statusText, { color: config.color }]}>
            {config.label}
          </Text>
          <View style={styles.capacityBadge}>
            <MaterialIcons
              name="person"
              size={12}
              color={WAITER_THEME.textSecondary}
            />
            <Text style={styles.capacityText}>{item.capacity}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isAvailable = selectedTable?.status === "available";

  return (
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
          <Ionicons name="reload" size={20} color={WAITER_THEME.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={WAITER_THEME.primary} />
          <Text style={{ marginTop: 16, color: WAITER_THEME.textSecondary }}>
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
              tintColor={WAITER_THEME.primary}
            />
          }
        />
      )}

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
              >
                <MaterialIcons
                  name="close"
                  size={28}
                  color={WAITER_THEME.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Set current status:</Text>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  {
                    borderColor: WAITER_THEME.status.available,
                    backgroundColor: WAITER_THEME.status.available + "10",
                  },
                ]}
                onPress={() => handleUpdateStatus("available")}
                disabled={updating || selectedTable?.status === "available"}
              >
                <MaterialIcons
                  name="check-circle"
                  size={24}
                  color={WAITER_THEME.status.available}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    { color: WAITER_THEME.status.available },
                  ]}
                >
                  Available
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  {
                    borderColor: WAITER_THEME.status.occupied,
                    backgroundColor: WAITER_THEME.status.occupied + "10",
                  },
                ]}
                onPress={() => handleUpdateStatus("occupied")}
                disabled={updating || selectedTable?.status === "occupied"}
              >
                <MaterialIcons
                  name="people"
                  size={24}
                  color={WAITER_THEME.status.occupied}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    { color: WAITER_THEME.status.occupied },
                  ]}
                >
                  Occupied
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  {
                    borderColor: WAITER_THEME.status.cleaning,
                    backgroundColor: WAITER_THEME.status.cleaning + "10",
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
                  color={WAITER_THEME.status.cleaning}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    { color: WAITER_THEME.status.cleaning },
                  ]}
                >
                  Cleaning
                </Text>
              </TouchableOpacity>
            </View>

            {updating && (
              <ActivityIndicator
                size="small"
                color={WAITER_THEME.primary}
                style={{ marginTop: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>
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
  centerState: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 12, paddingBottom: 100 },
  row: { justifyContent: "space-between", paddingHorizontal: 4 },
  tableCard: {
    backgroundColor: WAITER_THEME.cardBgLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: "48%",
    borderWidth: 1,
    borderColor: WAITER_THEME.ui.border,
    borderTopWidth: 4,
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.03)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tableNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: WAITER_THEME.textPrimary,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  statusText: { fontSize: 12, fontWeight: "bold", textTransform: "uppercase" },
  capacityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WAITER_THEME.backgroundLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: "600",
    color: WAITER_THEME.textSecondary,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: WAITER_THEME.cardBgLight,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
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
    fontWeight: "bold",
    color: WAITER_THEME.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: WAITER_THEME.textSecondary,
    marginBottom: 24,
  },
  modalOptions: { gap: 12 },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  statusOptionText: { fontSize: 16, fontWeight: "bold" },
});
